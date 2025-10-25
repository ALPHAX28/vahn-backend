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

  const data = req.body || {};
  // Normalize imageUrls: accept either an array or a comma-separated string
  let imageUrls = [];
  if (data.imageUrls) {
    if (Array.isArray(data.imageUrls)) {
      imageUrls = data.imageUrls.filter(Boolean);
    } else if (typeof data.imageUrls === 'string') {
      imageUrls = data.imageUrls.split(',').map(s => s.trim()).filter(Boolean);
    }
  }

  // Normalize onfield/offfield package selections which may come as arrays or comma-joined strings
  let onfield = [];
  let offfield = [];
  if (data.onfield) {
    if (Array.isArray(data.onfield)) onfield = data.onfield.filter(Boolean);
    else if (typeof data.onfield === 'string') onfield = data.onfield.split(',').map(s => s.trim()).filter(Boolean);
  }
  if (data.offfield) {
    if (Array.isArray(data.offfield)) offfield = data.offfield.filter(Boolean);
    else if (typeof data.offfield === 'string') offfield = data.offfield.split(',').map(s => s.trim()).filter(Boolean);
  }

  // Normalize designChoices: may be sent as an object or a JSON string
  let designChoices = null;
  if (data.designChoices) {
    if (typeof data.designChoices === 'string') {
      try {
        designChoices = JSON.parse(data.designChoices);
      } catch (e) {
        // if parse fails, leave as null
        designChoices = null;
      }
    } else if (typeof data.designChoices === 'object') {
      designChoices = data.designChoices;
    }
  }

  const submissionData = {
    ...data,
    imageUrls,
    onfield,
    offfield,
  designChoices,
    submittedAt: new Date()
  };

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

  const createListRow = (label, arr) => {
    if (!arr || !arr.length) return '';
    const items = arr.map(i => `<li style="margin-bottom:6px;color:#666;">${i}</li>`).join('');
    return `<div style="${styles.fieldGroup}"><div style="${styles.fieldLabel}; margin-bottom:8px;">${label}:</div><ul style="margin:0;padding-left:18px;">${items}</ul></div>`;
  };

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
  ${createListRow('On-field package', data.onfield)}
  ${createListRow('Off-field package', data.offfield)}

  ${(() => {
    if (!data.designChoices || typeof data.designChoices !== 'object') return '';
    // Map common design labels to the public image URLs we used on the front-end
    const thumbMap = {
      // Necklines
      'Crew Neck': 'https://i.ibb.co/vxrPBYX1/1-VAHN-Crew-Neck.png',
      'V-Neck': 'https://i.ibb.co/Hp2F12T2/2-VAHN-V-Neck.png',
      'Polo / Collared': 'https://i.ibb.co/bjTK1MnW/3-VAHN-Polo.png',
      'V-Neck Polo': 'https://i.ibb.co/b557rxkp/4-VAHN-V-Neck-Polo.png',
      'Mandarin': 'https://i.ibb.co/SDPgKvxx/5-VAHN-Mandarin.png',
      'Band Neck': 'https://i.ibb.co/pjHXwRRb/6-VAHN-Band-Neck.png',
      'Modified Band Neck': 'https://i.ibb.co/gZ89bP6Z/7-VAHN-Modified-Band-Neck.png',
      // Sleeves
      'Set-In (Standard)': 'https://i.ibb.co/Cpz0ChYw/1-VAHN-Sleeve-Style-Set-In.png',
      'Raglan': 'https://i.ibb.co/vx8nsRbN/2-VAHN-Sleeve-Style-Raglan.png',
      // Crests
      'Sublimated Crest': 'https://i.ibb.co/HfwJ8prt/1-VAHN-teamcrest-Sublimated-Crest.png',
      'Woven Patch': 'https://i.ibb.co/1tgDqhgQ/2-VAHN-teamcrest-Woven-Patch-Crest.png',
      '3D Silicone': 'https://i.ibb.co/0VhsBczf/3-VAHN-teamcrest-3-D-Silicone-Crest.png',
      // Fabric
      'Standard Fabric': 'https://i.ibb.co/svtBNcsd/1-VAHN-Standard-fabric.png',
      'Pro Fabric': 'https://i.ibb.co/Rp32NHQH/2-VAHN-Pro-fabric.png',
      'Pro V2 Fabric': 'https://i.ibb.co/tMBKmLB0/3-VAHN-Pro-V2-fabric.png',
      // Collar/cuff
      'Rib Knit': 'https://i.ibb.co/7xHyfVdK/2-Rib-knit-fabric.png',
      'Standard': 'https://i.ibb.co/3Y7VyC83/1-Standard-fabric.png'
    };

    let html = `<div style="${styles.sectionTitle}">Design Choices</div>`;
    Object.keys(data.designChoices).forEach(key => {
      const val = data.designChoices[key];
      if (!val) return;
      // Pretty-label the key: convert kebab or snake to Title Case
      const pretty = key.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      const thumb = thumbMap[val];
      const thumbHtml = thumb ? `<img src="${thumb}" alt="${val}" style="width:48px;height:48px;object-fit:contain;border:1px solid #eee;border-radius:4px;margin-right:8px;vertical-align:middle;"/>` : '';
      html += `<div style="${styles.fieldGroup}"><span style="${styles.fieldLabel}">${pretty}:</span> <span style="${styles.fieldValue}">${thumbHtml}${val}</span></div>`;
    });
    return html;
  })()}

  ${imagesHtml}

      </div>
    </div>
  `;
};


module.exports = handler;

