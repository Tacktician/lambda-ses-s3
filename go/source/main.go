package main

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/aws/aws-lambda-go/events"
	"github.com/aws/aws-lambda-go/lambda"
	"github.com/aws/aws-sdk-go/aws"
	"github.com/aws/aws-sdk-go/aws/session"
	"github.com/aws/aws-sdk-go/service/s3"
	"github.com/aws/aws-sdk-go/service/ses"
	"github.com/jhillyerd/enmime"
)

// MailConfig represents the configuration for mail processing.
type MailConfig struct {
	MailBucket              string
	BouncePath              string
	ForwardAsName           string
	ForwardAsMail           string
	ForwardToName           string
	ForwardToMail           string
	SESConfigurationSetName string
}

// ReceiveMail is the Lambda handler for processing incoming emails.
func ReceiveMail(event events.SimpleEmailEvent) (interface{}, error) {
	config := MailConfig{
		MailBucket:              os.Getenv("MAIL_BUCKET"),
		BouncePath:              os.Getenv("FORWARD_BOUNCE_PATH"),
		ForwardAsName:           os.Getenv("FORWARD_AS_NAME"),
		ForwardAsMail:           os.Getenv("FORWARD_AS_EMAIL"),
		ForwardToName:           os.Getenv("FORWARD_TO_NAME"),
		ForwardToMail:           os.Getenv("FORWARD_TO_EMAIL"),
		SESConfigurationSetName: "mailing-default",
	}

	// Create our AWS SDK configuration and clients
	cfg := aws.NewConfig()
	sess, err := session.NewSession(cfg)
	if err != nil {
		return nil, fmt.Errorf("could not create session: %w", err)
	}

	s3Client := s3.New(sess)
	mailClient := ses.New(sess)

	for _, record := range event.Records {
		// Retrieve the MessageID from the email headers
		messageID := strings.Trim(record.SES.Mail.CommonHeaders.MessageID, "<>")

		// Use the MessageID as the object key
		objectKey := "emails/" + messageID

		// Retrieve mail contents from S3
		obj, err := s3Client.GetObject(&s3.GetObjectInput{
			Bucket: aws.String(config.MailBucket),
			Key:    aws.String(objectKey),
		})
		if err != nil {
			return nil, fmt.Errorf("could not get object: %w", err)
		}

		// Rewrite mail contents
		rewrittenMail, err := rewriteMail(obj.Body, config)
		if err != nil {
			return nil, fmt.Errorf("could not rewrite mail: %w", err)
		}

		// Send using SES
		_, err = mailClient.SendRawEmail(&ses.SendRawEmailInput{
			ConfigurationSetName: aws.String(config.SESConfigurationSetName),
			RawMessage: &ses.RawMessage{
				Data: rewrittenMail,
			},
		})
		if err != nil {
			return nil, fmt.Errorf("could not forward mail: %w", err)
		}

		// Delete from bucket if everything worked
		_, err = s3Client.DeleteObject(&s3.DeleteObjectInput{
			Bucket: aws.String(config.MailBucket),
			Key:    aws.String(record.SES.Mail.MessageID),
		})
		if err != nil {
			return nil, fmt.Errorf("could not delete email from S3: %w", err)
		}
	}

	return event, nil
}

func rewriteMail(mailReader io.Reader, config MailConfig) ([]byte, error) {
	// Read incoming mail content (S3 object body)
	envelope, err := enmime.ReadEnvelope(mailReader)
	if err != nil {
		return nil, fmt.Errorf("could not read mail parts: %w", err)
	}

	// Read current subject, sender, and destination
	currentSubject := envelope.GetHeader("Subject")
	currentFrom := envelope.GetHeader("From")
	currentTo := envelope.GetHeader("To")

	// Rewrite sender to verified SES email (needs to be authorized)
	err = envelope.SetHeader("From", []string{fmt.Sprintf("%s <%s>", config.ForwardAsName, config.ForwardAsMail)})
	if err != nil {
		return nil, fmt.Errorf("could not update from: %w", err)
	}

	// Rewrite destination to forward target
	err = envelope.SetHeader("To", []string{fmt.Sprintf("%s <%s>", config.ForwardToName, config.ForwardToMail)})
	if err != nil {
		return nil, fmt.Errorf("could not update to: %w", err)
	}

	// Set authorized bounce target if forwarding fails
	err = envelope.SetHeader("Return-Path", []string{config.BouncePath})

	// Set current origin as "Reply To"
	err = envelope.SetHeader("Reply-To", []string{currentFrom})

	// Update subject to include Fwd
	err = envelope.SetHeader("Subject", []string{fmt.Sprintf("Fwd: (%s) %s", currentTo, currentSubject)})
	if err != nil {
		return nil, fmt.Errorf("could not update subject: %w", err)
	}

	buf := &bytes.Buffer{}
	err = envelope.Root.Encode(buf)
	if err != nil {
		return nil, fmt.Errorf("could not encode updated mail: %w", err)
	}

	return buf.Bytes(), nil
}

func main() {
	// Make the handler available for
	// Remote Procedure Call by AWS Lambda
	lambda.Start(ReceiveMail)
}
