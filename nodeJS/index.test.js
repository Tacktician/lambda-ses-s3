import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { SESClient } from '@aws-sdk/client-ses';
import { handler } from './index'; // Replace with your Lambda function file

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/client-ses');

const mockEventWithMailBody = {
    Records: [
        {
            ses: {
                mail: {
                    commonHeaders: {
                        messageId: 'example-message-id2',
                    },
                },
                content: {
                    mail: 'Sample email content', // Replace with the actual mail body
                },
            },
        },
    ],
};

const mockS3GetObjectResponse = {
    Body: {
        toString: () => 'Sample email content', // Convert the email content to string as needed
    },
};

const mockSendRawEmailResponse = {
    MessageId: '1234567890123456',
};

const mockDeleteObjectResponse = {};

describe('Lambda Function', () => {
    afterEach(() => {
        jest.clearAllMocks();
    });

    test('should process email and forward it', async () => {
        // Mock S3 getObject
        S3Client.prototype.send = jest.fn().mockResolvedValue(mockS3GetObjectResponse);

        // Mock SES sendRawEmail
        SESClient.prototype.send = jest.fn().mockResolvedValue(mockSendRawEmailResponse);

        // Mock S3 deleteObject
        S3Client.prototype.send = jest.fn().mockResolvedValue(mockDeleteObjectResponse);

        // Set environment variables
        process.env.MAIL_BUCKET = 'mail-bucket-name';
        process.env.FORWARD_BOUNCE_PATH = 'bounce@example.com';
        process.env.FORWARD_AS_NAME = 'Forwarder';
        process.env.FORWARD_AS_EMAIL = 'forwarder@example.com';
        process.env.FORWARD_TO_NAME = 'Recipient';
        process.env.FORWARD_TO_EMAIL = 'recipient@example.com';

        // Invoke the Lambda function
        const result = await handler(mockEventWithMailBody);

        // Assert the function result
        expect(result).toEqual(mockEventWithMailBody);
    });

    test('should handle errors', async () => {
        // Mock S3 getObject to simulate an error
        S3Client.prototype.send = jest.fn().mockRejectedValue(new Error('Error getting object'));

        // Invoke the Lambda function
        const result = await handler(mockEventWithMailBody);

        // Assert the function result
        expect(result).toEqual(mockEventWithMailBody);
    });
});