const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');
const cors = require('cors');

// --- Initialize CORS ---
const corsHandler = cors({
  origin: process.env.FRONTEND_URL,
  methods: ['POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true,
});

// --- Main Handler ---
const handler = async (req, res) => {
  // Use a middleware pattern to handle CORS
  // This ensures the OPTIONS request is handled before your main logic
  corsHandler(req, res, async () => {

    // For a CORS preflight request, the method is OPTIONS.
    // We can end the response here after CORS headers are set.
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', ['POST', 'OPTIONS']);
      return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const data = req.body;
    
    // --- MongoDB Connection ---
    const client = new MongoClient(process.env.MONGODB_URI);
    try {
      await client.connect();
      const database = client.db('form-submissions');
      const collection = database.collection('projects');
      await collection.insertOne(data);
    } catch (error) {
      console.error('MongoDB Error:', error);
      return res.status(500).json({ message: 'Error saving to database.' });
    } finally {
      await client.close();
    }

    // --- Nodemailer Transport ---
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_TO,
      subject: `New Project Submission from ${data['first-name']} ${data['last-name']}`,
      html: `<p>You have a new project submission. Details:</p><pre>${JSON.stringify(data, null, 2)}</pre>`,
    };

    // --- Send Email ---
    try {
      await transporter.sendMail(mailOptions);
      return res.status(200).json({ message: 'Submission successful!' });
    } catch (error) {
      console.error('Nodemailer Error:', error);
      return res.status(500).json({ message: 'Error sending email.' });
    }
  });
};

module.exports = handler;

