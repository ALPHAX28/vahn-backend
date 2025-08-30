const { MongoClient } = require('mongodb');
const nodemailer = require('nodemailer');

const handler = async (req, res) => {
  // --- Manually set CORS headers ---
  const allowedOrigin = process.env.FRONTEND_URL;
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST', 'OPTIONS']);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const data = req.body;
  // The image URLs from UploadThing will be in data.imageUrls
  // It will be a string of comma-separated URLs, so we split it into an array.
  const imageUrls = data.imageUrls ? data.imageUrls.split(',') : [];

  const submissionData = { ...data, imageUrls, submittedAt: new Date() };

  // --- MongoDB Connection ---
  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const database = client.db('form-submissions');
    const collection = database.collection('projects');
    await collection.insertOne(submissionData);
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

  const emailHtml = generateEmailHTML(submissionData);
  const userEmail = data['email'];
  const recipients = [process.env.EMAIL_TO, userEmail];

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: recipients,
    subject: `New Project Submission from ${data['first-name'] || 'Unknown'} ${data['last-name'] || ''}`,
    html: emailHtml,
  };

  try {
    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: 'Submission successful!' });
  } catch (error) {
    console.error('Nodemailer Error:', error);
    return res.status(500).json({ message: 'Error sending email.' });
  }
};

const generateEmailHTML = (data) => {
    // ... (email template logic remains the same, but we add an image section)
    const styles = {
        body: `font-family: Arial, sans-serif; background-color: #f4f4f4; margin: 0; padding: 20px;`,
        container: `background-color: #ffffff; border-radius: 8px; padding: 30px; max-width: 600px; margin: auto; box-shadow: 0 4px 10px rgba(0,0,0,0.1);`,
        header: `font-size: 24px; font-weight: bold; color: #333; border-bottom: 2px solid #eee; padding-bottom: 15px; margin-bottom: 20px; text-align: center;`,
        sectionTitle: `font-size: 18px; font-weight: bold; color: #555; margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px;`,
        fieldLabel: `font-weight: bold; color: #333;`,
        fieldValue: `color: #666;`,
        fieldGroup: `margin-bottom: 12px;`,
        colorSwatch: `display: inline-block; width: 20px; height: 20px; border-radius: 50%; border: 1px solid #ddd; vertical-align: middle; margin-right: 10px;`,
        imageGallery: `margin-top: 15px; display: flex; flex-wrap: wrap; gap: 10px;`,
        imageWrapper: `width: 100px; height: 100px; border-radius: 4px; overflow: hidden; border: 1px solid #eee;`,
        image: `width: 100%; height: 100%; object-fit: cover;`
    };

    const createRow = (label, value) => {
        if (!value) return '';
        return `<div style="${styles.fieldGroup}"><span style="${styles.fieldLabel}">${label}:</span> <span style="${styles.fieldValue}">${value}</span></div>`;
    };

    const createColorRow = (label, colorValue) => {
        if (!colorValue) return '';
        return `<div style="${styles.fieldGroup}"><span style="${styles.fieldLabel}">${label}:</span><span style="background-color: ${colorValue}; ${styles.colorSwatch}"></span><span style="${styles.fieldValue}">${colorValue}</span></div>`;
    };
    
    // Create the image gallery HTML
    let imagesHtml = '';
    if (data.imageUrls && data.imageUrls.length > 0) {
        imagesHtml += `<div style="${styles.sectionTitle}">Uploaded Design Files</div>`;
        imagesHtml += `<div style="${styles.imageGallery}">`;
        data.imageUrls.forEach(url => {
            imagesHtml += `<div style="${styles.imageWrapper}"><a href="${url}" target="_blank"><img src="${url}" alt="Uploaded Image" style="${styles.image}"></a></div>`;
        });
        imagesHtml += `</div>`;
    }

    return `
    <div style="${styles.body}">
      <div style="${styles.container}">
        <div style="${styles.header}">New Project Submission</div>
        
        <div style="${styles.sectionTitle}">Contact Information</div>
        ${createRow('Name', `${data['first-name']} ${data['last-name']}`)}
        ${createRow('Email', `<a href="mailto:${data['email']}">${data['email']}</a>`)}
        ${createRow('Phone', data['phone'])}
        ${createRow('Affiliation', data['affiliation'] === 'Other' ? data['other-affiliation-specify'] : data['affiliation'])}

        <div style="${styles.sectionTitle}">Team & Order Details</div>
        ${createRow('Team/Organization Name', data['team-name'])}
        ${createRow('Year Founded', data['team-founded'])}
        ${createRow('Sport', data['sport'] === 'Other' ? data['other-sport-specify'] : data['sport'])}
        ${createRow('Number of Athletes', data['athletes-number'])}
        
        <div style="${styles.sectionTitle}">Design & Project Overview</div>
        ${createColorRow('Primary Color', data['primary-color'])}
        ${createColorRow('Accent Color 1', data['accent-color'])}
        ${createColorRow('Accent Color 2', data['accent-color-2'])}
        ${createRow('Project Overview', `<p style="white-space: pre-wrap; margin: 0; color: #666;">${data['project-overview']}</p>`)}
        
        ${imagesHtml}

      </div>
    </div>
  `;
};


module.exports = handler;

