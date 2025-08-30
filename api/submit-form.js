const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');

const handler = async (req, res) => {
  // --- Manually set CORS headers ---
  // This is a more direct way to handle CORS in a serverless environment.
  const allowedOrigin = process.env.FRONTEND_URL;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // Handle the browser's preflight OPTIONS request
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
};

module.exports = handler;

