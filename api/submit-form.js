// This is a serverless function for a SEPARATED frontend and backend.
// It includes CORS handling to allow requests from your frontend's domain.

const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
const cors = require('cors');

// --- CONFIGURATION ---
// Store these values in environment variables on your hosting platform
const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = 'jersey-bird-submissions';
const COLLECTION_NAME = 'projects';

const EMAIL_CONFIG = {
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
};

const NOTIFICATION_EMAIL = process.env.EMAIL_TO;
// IMPORTANT: Add your frontend's live URL to your environment variables
const ALLOWED_ORIGIN = process.env.FRONTEND_URL;

// --- CORS Middleware ---
// This initializes CORS with the specific origin of your frontend application
const corsMiddleware = cors({
    origin: ALLOWED_ORIGIN,
});

// Helper to run middleware
const runMiddleware = (req, res, fn) => {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
};

// --- MAIN HANDLER FUNCTION ---
module.exports = async (req, res) => {
    // Run the CORS middleware first
    await runMiddleware(req, res, corsMiddleware);
    
    // Browsers send a pre-flight OPTIONS request to check CORS before a POST
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST, OPTIONS');
        return res.status(405).end('Method Not Allowed');
    }

    const submissionData = req.body;

    try {
        // Save to MongoDB
        const mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        const db = mongoClient.db(DB_NAME);
        const collection = db.collection(COLLECTION_NAME);
        submissionData.submittedAt = new Date();
        await collection.insertOne(submissionData);
        await mongoClient.close();
        console.log('Submission saved to MongoDB.');

        // Send Email Notification
        const transporter = nodemailer.createTransport(EMAIL_CONFIG);
        const emailHtml = `
            <h1>New JerseyBird Project Submission</h1>
            <p>Details below:</p><hr>
            <ul>
                ${Object.entries(submissionData)
                  .map(([key, value]) => `<li><strong>${key.replace(/-/g, ' ')}:</strong> ${value}</li>`)
                  .join('')}
            </ul>`;
        await transporter.sendMail({
            from: `"JerseyBird Form" <${EMAIL_CONFIG.auth.user}>`,
            to: NOTIFICATION_EMAIL,
            subject: `New Submission from ${submissionData['first-name'] || 'N/A'}`,
            html: emailHtml,
        });
        console.log('Email notification sent.');

        // Send Success Response
        return res.status(200).json({ message: 'Submission successful!' });

    } catch (error) {
        console.error('An error occurred:', error);
        return res.status(500).json({ message: 'An internal error occurred.' });
    }
};

