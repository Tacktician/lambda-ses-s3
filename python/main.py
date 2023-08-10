import os
import json
import boto3
from botocore.exceptions import ClientError
from mailparser import parse_from_bytes

s3 = boto3.client('s3', region_name='us-east-1')
ses = boto3.client('ses', region_name='us-east-1')

def handler(event, context):
    mail_bucket = os.environ['MAIL_BUCKET']
    bounce_path = os.environ['FORWARD_BOUNCE_PATH']
    forward_as_name = os.environ['FORWARD_AS_NAME']
    forward_as_email = os.environ['FORWARD_AS_EMAIL']
    forward_to_name = os.environ['FORWARD_TO_NAME']
    forward_to_email = os.environ['FORWARD_TO_EMAIL']

    for record in event['Records']:
        message_id = record['ses']['mail']['commonHeaders']['messageId']
        object_key = f'emails/{message_id}'

        try:
            # Retrieve mail contents from S3
            try:
                response = s3.get_object(Bucket=mail_bucket, Key=object_key)
                email_contents = response['Body'].read().decode('utf-8')
            except ClientError as e:
                print('Error retrieving email contents from S3:', e)
                continue  # Skip processing this email and move to the next one

            rewritten_mail = rewrite_mail(
                email_contents,
                bounce_path,
                forward_as_name,
                forward_as_email,
                forward_to_name,
                forward_to_email
            )

            # Send using SES
            try:
                response = ses.send_raw_email(
                    RawMessage={'Data': rewritten_mail},
                    ConfigurationSetName='mailing-default'
                )
            except ClientError as e:
                print('Error sending raw email using SES:', e)
                continue  # Skip processing this email and move to the next one

            # Delete from bucket if everything worked
            try:
                response = s3.delete_object(Bucket=mail_bucket, Key=message_id)
            except ClientError as e:
                print('Error deleting email from S3:', e)

        except Exception as e:
            print('Error processing email:', e)

    return event

def rewrite_mail(mail_body, bounce_path, forward_as_name, forward_as_email, forward_to_name, forward_to_email):
    parsed_mail = parse_from_bytes(mail_body.encode('utf-8'))

    # Read current subject, sender, and destination
    current_subject = parsed_mail.subject
    current_from = parsed_mail.from_[0]
    current_to = parsed_mail.to[0]

    # Rewrite sender to verified SES email (needs to be authorized)
    parsed_mail.from_ = [(forward_as_name, forward_as_email)]

    # Rewrite destination to forward target
    parsed_mail.to = [(forward_to_name, forward_to_email)]

    # Set authorized bounce target if forwarding fails
    parsed_mail.envelope = (bounce_path,)

    # Set current origin as "Reply To"
    parsed_mail.reply_to = [(current_from[0], current_from[1])]

    # Update subject to include Fwd
    parsed_mail.subject = f'Fwd: ({current_to[1]}) {current_subject}'

    # Generate the updated email content
    return parsed_mail.mail.as_bytes().decode('utf-8')
