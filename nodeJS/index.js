import { SESClient, SendRawEmailCommand } from '@aws-sdk/client-ses';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { simpleParser as MailParser } from 'mailparser';

const s3 = new S3Client({ region: 'us-east-1' });
const ses = new SESClient({ region: 'us-east-1' });

export const handler = async (event) => {
  const mailBucket = process.env.MAIL_BUCKET;
  const bouncePath = process.env.FORWARD_BOUNCE_PATH;
  const forwardAsName = process.env.FORWARD_AS_NAME;
  const forwardAsEmail = process.env.FORWARD_AS_EMAIL;
  const forwardToName = process.env.FORWARD_TO_NAME;
  const forwardToEmail = process.env.FORWARD_TO_EMAIL;

  for (const record of event.Records) {
    const messageID = record.ses.mail.commonHeaders.messageId;
    const objectKey = `emails/${messageID}`;

    try {
      // Retrieve mail contents from S3
      const getObjectCommand = new GetObjectCommand({
        Bucket: mailBucket,
        Key: objectKey,
      });

      let obj;
      try {
        obj = await s3.send(getObjectCommand);
      } catch (err) {
        console.error('Error retrieving email contents from S3:', err);
        continue; // Skip processing this email and move to the next one
      }
      let emailContents;
      try {
        emailContents = obj.Body.transformToString();
      } catch (err) {
        console.error('Error processing email contents:', err);
        console.error('Email Contents:', emailContents);
        continue; // Skip processing this email and move to the next one
      }
      // Modify this line to pass the correct mailBody to the rewriteMail function
      const rewrittenMail = await rewriteMail(
          emailContents,
          bouncePath,
          forwardAsName,
          forwardAsEmail,
          forwardToName,
          forwardToEmail
      );

      // Send using SES
      const sendRawEmailCommand = new SendRawEmailCommand({
        RawMessage: {
          Data: rewrittenMail,
        },
        ConfigurationSetName: 'mailing-default',
      });
      await ses.send(sendRawEmailCommand);

      // Delete from bucket if everything worked
      const deleteObjectCommand = new DeleteObjectCommand({
        Bucket: mailBucket,
        Key: messageID,
      });
      await s3.send(deleteObjectCommand);
    } catch (err) {
      console.error('Error processing email:', err);
      // // Handle the error for failed S3 object deletion
      // console.error('Error deleting S3 object:', err);
    }
  }

  return event;
};

export async function rewriteMail(mailBody, bouncePath, forwardAsName, forwardAsEmail, forwardToName, forwardToEmail) {
  // Check if mailBody is null or undefined
  if (mailBody === null || mailBody === undefined) {
    throw new Error('mailBody cannot be null or undefined');
  }

  // Parse the email using mailparser
  const parsedMail = await MailParser(mailBody);

  // Read current subject, sender, and destination
  const currentSubject = parsedMail.subject;
  const currentFrom = parsedMail.from?.text || '';
  const currentTo = parsedMail.to?.text || '';

  // Rewrite sender to verified SES email (needs to be authorized)
  parsedMail.from = [{ name: forwardAsName, address: forwardAsEmail }];

  // Rewrite destination to forward target
  parsedMail.to = [{ name: forwardToName, address: forwardToEmail }];

  // Set authorized bounce target if forwarding fails
  parsedMail.envelope = { from: bouncePath };

  // Set current origin as "Reply To"
  parsedMail.replyTo = [{ name: '', address: currentFrom }];

  // Update subject to include Fwd
  parsedMail.subject = `Fwd: (${currentTo}) ${currentSubject}`;

  // Generate the updated email content
  return parsedMail.generate();
}