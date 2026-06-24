const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Doctor = require('../models/Doctor');
const { DEFAULT_CONSULTATION_FEE, normalizeConsultationFee } = require('../utils/consultationPricing');
const PendingDoctor = require('../models/PendingDoctors');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sendEmail = require('../utils/sendEmail'); 
const { appendQualifications, normaliseQualifications } = require('../utils/doctorQualifications');

// Helpers
const generateToken = (id) => jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
const isAdminAccount = (user) => Boolean(user?.isAdmin || user?.email === 'admin@medimeet.com');

// --- UPDATED: Multer Setup ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/profile_photos');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Safely assign a prefix if the user is not logged in yet (like applying doctors or registering patients)
    const prefix = req.user ? req.user._id : 'pending';
    cb(null, `${prefix}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }).single('photo');

// --- AUTH CONTROLLERS ---
// --- UPDATED: Wrapped in upload middleware to handle patient profile pictures ---
const registerUser = asyncHandler(async (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });

    try {
      const name = req.body.name?.trim();
      const email = req.body.email?.trim().toLowerCase();
      const gender = req.body.gender?.trim();
      const age = Number(req.body.age);
      const password = req.body.password; 

      if (!name || !email || !gender || !req.body.age || !password) {
        return res.status(400).json({ message: "Please fill all required fields." });
      }

      if (!['Male', 'Female', 'Other'].includes(gender)) {
        return res.status(400).json({ message: "Please select a valid gender." });
      }

      if (!Number.isInteger(age) || age < 0 || age > 120) {
        return res.status(400).json({ message: "Please enter a valid age between 0 and 120." });
      }

      // Check if user exists
      const userExists = await User.findOne({ email });
      if (userExists) {
        return res.status(400).json({ message: "User already exists with this email." });
      }

      // Build user data object
      const userData = { name, email, gender, age, password };

      // If they uploaded a photo, add the path to the database
      if (req.file) {
        userData.image = `uploads/profile_photos/${req.file.filename}`;
      }

      const user = await User.create(userData);

      res.status(201).json({ 
        _id: user._id, 
        name: user.name, 
        email: user.email, 
        gender: user.gender,
        age: user.age,
        image: user.image, // Send the image back to the frontend
        token: generateToken(user._id),
        type: 'patient'
      });
    } catch (error) {
      res.status(500).json({ message: error.message || "Server Error during registration" });
    }
  });
});

const loginUser = asyncHandler(async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const password = req.body.password; 

  // Basic Validation
  if (!email || !password) {
    res.status(400);
    throw new Error('Email and password are required.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400);
    throw new Error('Invalid email format.');
  }
  if (password.length < 6) {
    res.status(400);
    throw new Error('Password must be at least 6 characters.');
  }

  const user = await User.findOne({ email });
  
  if (user && (await user.matchPassword(password))) {
    
    if (user.isTwoFactorEnabled) {
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      user.loginOtp = generatedOtp;
      user.loginOtpExpire = Date.now() + 10 * 60 * 1000; 
      await user.save();

      try {
        const emailHtml = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>MediMeet Secure Login</title>
        </head>
        <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0; -webkit-font-smoothing: antialiased;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f7f6; padding: 40px 20px;">
                <tr>
                    <td align="center">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.05); max-width: 600px;">
                            <tr>
                                <td style="background: linear-gradient(135deg, #6366F1 0%, #0aa87e 100%); padding: 30px 40px; text-align: center;">
                                    <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: 1px;">MediMeet</h1>
                                    <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">Your Trusted Medical Partner</p>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 40px;">
                                    <h2 style="color: #1a2e2b; font-size: 22px; font-weight: 700; margin: 0 0 20px 0;">Authentication Required</h2>
                                    <p style="color: #4a6560; font-size: 16px; line-height: 1.6; margin: 0 0 30px 0;">
                                        Hello <strong style="color: #1a2e2b;">${user.name || 'Patient'}</strong>,<br><br>
                                        We received a request to log in to your MediMeet account. To protect your sensitive medical data, please use the secure One-Time Password (OTP) below to complete your login.
                                    </p>
                                    <div style="background-color: #f5f8f7; border: 2px dashed #c0dfd8; border-radius: 12px; padding: 30px; text-align: center; margin-bottom: 30px;">
                                        <span style="display: block; color: #8fa8a3; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 10px;">Your Security Code</span>
                                        <span style="display: inline-block; font-size: 42px; font-weight: 800; color: #6366F1; letter-spacing: 8px;">${generatedOtp}</span>
                                    </div>
                                    <p style="color: #4a6560; font-size: 14px; text-align: center; margin: 0 0 30px 0; background-color: #fffbeb; padding: 12px; border-radius: 8px; border-left: 4px solid #f59e0b;">
                                        ⏱️ This code will expire in <strong>10 minutes</strong>.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        `;

        await sendEmail({
          email: user.email,
          subject: 'Your MediMeet Secure Login Code',
          message: `Your login OTP is ${generatedOtp}. It will expire in 10 minutes.`, 
          html: emailHtml 
        });
        
        return res.json({ mfaRequired: true, message: "OTP sent to your registered email." });
      } catch (error) {
        user.loginOtp = undefined;
        user.loginOtpExpire = undefined;
        await user.save();
        res.status(500);
        throw new Error('Email could not be sent');
      }
    }

    const isAdmin = isAdminAccount(user);
    const userType = isAdmin ? 'admin' : 'patient';

    res.json({ 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      token: generateToken(user._id),
      type: userType,
      isAdmin: isAdmin 
    });
  } else {
    res.status(401); 
    throw new Error('Invalid email or password');
  }
});

const verifyPatientOtp = asyncHandler(async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const otp = req.body.otp?.trim();
  const user = await User.findOne({ email });

  if (!user) {
    res.status(401);
    throw new Error('User not found');
  }

  const dbOtp = String(user.loginOtp).trim();
  const inputOtp = String(otp).trim();
  const currentTime = Date.now();
  const expiryTime = user.loginOtpExpire ? new Date(user.loginOtpExpire).getTime() : 0;

  const isOtpValid = dbOtp === inputOtp;
  const isNotExpired = expiryTime > currentTime;

  if (isOtpValid && isNotExpired) {
    user.loginOtp = undefined; 
    user.loginOtpExpire = undefined;
    await user.save();

    const isAdmin = isAdminAccount(user);
    const userType = isAdmin ? 'admin' : 'patient';

    res.json({ 
      _id: user._id, 
      name: user.name, 
      email: user.email, 
      token: generateToken(user._id),
      type: userType,
      isAdmin: isAdmin
    });
  } else {
    res.status(401); 
    if (!isNotExpired) {
      throw new Error('This OTP has expired. Please log in again to get a new one.');
    } else {
      throw new Error('Invalid OTP code. Please check and try again.');
    }
  }
});

// --- PROFILE CONTROLLERS ---
const getUserProfile = asyncHandler(async (req, res) => {
  if (req.user.licenseNumber !== undefined) {
    const doctor = await Doctor.findById(req.user._id).select('-password -loginOtp -loginOtpExpire -resetPasswordOtp -resetPasswordOtpExpire');
    if (!doctor) {
      res.status(404);
      throw new Error('Doctor not found');
    }
    const shapedDoctor = doctor.toObject();
    shapedDoctor.fee = normalizeConsultationFee(shapedDoctor.fee, DEFAULT_CONSULTATION_FEE);
    shapedDoctor.consultationFee = shapedDoctor.fee;
    shapedDoctor.type = 'doctor';
    return res.json(shapedDoctor);
  }

  const user = await User.findById(req.user._id).select('-password -loginOtp -loginOtpExpire -resetPasswordOtp -resetPasswordOtpExpire');
  if (!user) {
    res.status(404);
    throw new Error('User not found');
  }

  const isAdmin = isAdminAccount(user);
  const userType = isAdmin ? 'admin' : 'patient';

  res.json({ ...user.toObject(), type: userType, isAdmin: isAdmin });
});

const updateProfile = asyncHandler(async (req, res) => {
  if (req.user.licenseNumber !== undefined) {
    const doctor = await Doctor.findById(req.user._id);
    if (!doctor) {
      res.status(404);
      throw new Error('Doctor not found');
    }

    doctor.email = req.body.email ? String(req.body.email).trim().toLowerCase() : doctor.email;
    doctor.phone = req.body.phone || doctor.phone;
    doctor.specialization = req.body.specialization || doctor.specialization;
    doctor.licenseNumber = req.body.licenseNumber || doctor.licenseNumber;
    if (req.body.experience !== undefined && req.body.experience !== '') {
      doctor.experience = Number(req.body.experience);
    }
    const qualificationsInput = req.body.newQualifications !== undefined
      ? req.body.newQualifications
      : req.body.qualifications;
    if (qualificationsInput !== undefined) {
      doctor.qualifications = appendQualifications(doctor.qualifications, qualificationsInput);
    }
    if (req.body.isAvailable !== undefined) {
      doctor.isAvailable = Boolean(req.body.isAvailable);
    }
    if (req.body.isTwoFactorEnabled !== undefined) {
      doctor.isTwoFactorEnabled = Boolean(req.body.isTwoFactorEnabled);
    }

    const updatedDoctor = await doctor.save();
    const io = req.app.get('io');
    if (io) {
      io.emit('doctors:updated', {
        reason: 'profile-updated',
        doctorId: String(updatedDoctor._id)
      });
    }

    const shapedDoctor = updatedDoctor.toObject();
    delete shapedDoctor.password;
    shapedDoctor.fee = normalizeConsultationFee(shapedDoctor.fee, DEFAULT_CONSULTATION_FEE);
    shapedDoctor.consultationFee = shapedDoctor.fee;
    shapedDoctor.type = 'doctor';
    return res.json(shapedDoctor);
  }

  const user = await User.findById(req.user._id);
  if (user) {
    user.name = req.body.name || user.name;
    user.email = req.body.email ? String(req.body.email).trim().toLowerCase() : user.email;
    user.phone = req.body.phone || user.phone;
    user.dob = req.body.dob || user.dob;
    user.gender = req.body.gender || user.gender;
    user.blood = req.body.blood || user.blood;
    user.allergies = req.body.allergies || user.allergies;
    user.emergency = req.body.emergency || user.emergency;
    
    if (req.body.isTwoFactorEnabled !== undefined) {
      user.isTwoFactorEnabled = req.body.isTwoFactorEnabled;
    }
    
    const updatedUser = await user.save();

    const isAdmin = isAdminAccount(updatedUser);
    const userType = isAdmin ? 'admin' : 'patient';

    res.json({ ...updatedUser.toObject(), type: userType, isAdmin: isAdmin });
  } else {
    res.status(404); 
    throw new Error('User not found');
  }
});

const updateUserPhoto = asyncHandler(async (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    try {
      const model = req.user.licenseNumber !== undefined ? Doctor : User;
      const user = await model.findById(req.user._id);
      if (!user) return res.status(404).json({ message: 'User not found' });

      user.image = `uploads/profile_photos/${req.file.filename}`;
      await user.save();
      if (req.user.licenseNumber !== undefined) {
        const io = req.app.get('io');
        if (io) {
          io.emit('doctors:updated', {
            reason: 'profile-photo-updated',
            doctorId: String(user._id)
          });
        }
      }
      
      res.json({ image: user.image });
    } catch (error) {
      res.status(500).json({ message: 'Failed to save image to database' });
    }
  });
});

const removeUserPhoto = asyncHandler(async (req, res) => {
  const model = req.user.licenseNumber !== undefined ? Doctor : User;
  const user = await model.findById(req.user._id);
  user.image = '/images/default-avatar.png';
  await user.save();
  res.json({ message: 'Photo removed' });
});

const toggleTwoFactor = asyncHandler(async (req, res) => {
  const enabled = Boolean(req.body.enabled);
  const model = req.user.licenseNumber !== undefined ? Doctor : User;
  const account = await model.findById(req.user._id);
  if (!account) {
    res.status(404);
    throw new Error('Account not found');
  }

  account.isTwoFactorEnabled = enabled;
  await account.save();
  res.json({ isTwoFactorEnabled: enabled });
});

const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400);
    throw new Error('Current password and new password are required.');
  }

  if (String(newPassword).length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters.');
  }

  const model = req.user.licenseNumber !== undefined ? Doctor : User;
  const account = await model.findById(req.user._id).select('+password');
  if (!account) {
    res.status(404);
    throw new Error('Account not found');
  }

  const isMatch = await account.matchPassword(currentPassword);
  if (!isMatch) {
    res.status(401);
    throw new Error('Current password is incorrect.');
  }

  account.password = newPassword;
  await account.save();
  res.json({ success: true });
});

// --- DOCTOR AUTH CONTROLLERS ---
// --- UPDATED: Wrapped in upload middleware to handle the image ---
const applyDoctor = asyncHandler(async (req, res) => {
  upload(req, res, async (err) => {
    if (err) return res.status(400).json({ message: err.message });
    if (!req.file) return res.status(400).json({ message: "Passport photo is required for verification." });

    try {
      const email = req.body.email?.trim().toLowerCase();

      // 1. Check if an approved doctor exists
      const doctorExists = await Doctor.findOne({ email });
      if (doctorExists) {
          return res.status(400).json({ message: "A doctor account with this email already exists." });
      }

      // 2. Check if a pending application already exists
      const pendingExists = await PendingDoctor.findOne({ email });
      if (pendingExists) {
          return res.status(400).json({ message: "An application with this email is already pending approval." });
      }

      const experienceAmount = req.body.experience ? Number(req.body.experience) : 0;
      const qualifications = normaliseQualifications(req.body.qualifications);

      if (qualifications.length === 0) {
        return res.status(400).json({ message: "At least one qualification is required." });
      }

      // 3. Save to the PendingDoctor collection WITH the image
      const pendingDoctor = new PendingDoctor({
        name: req.body.name,
        email: email,
        phone: req.body.phone,
        specialization: req.body.specialization,
        licenseNumber: req.body.licenseNumber,
        qualifications,
        experience: experienceAmount,
        fee: DEFAULT_CONSULTATION_FEE,
        password: req.body.password,
        image: `uploads/profile_photos/${req.file.filename}` // Save the path
      });
      
      await pendingDoctor.save();

      const io = req.app.get('io');
      if (io) {
        io.emit('admin:doctor-applications-updated', {
          reason: 'application-submitted',
          pendingDoctorId: String(pendingDoctor._id)
        });
      }

      res.status(201).json({ message: "Application submitted successfully. Our team will verify your details soon." });
    } catch (error) {
      console.error("🔥 APPLY DOCTOR CRASH:", error.message);
      res.status(400).json({ message: error.message || "Failed to process application." });
    }
  });
});
// Replace your existing loginDoctor function in authController.js with this:

const loginDoctor = asyncHandler(async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    const password = req.body.password;
    
    // FIXED: Added .select('+password') to retrieve the hidden password hash
    const doctor = await Doctor.findOne({ email }).select('+password');
  
    if (doctor && (await doctor.matchPassword(password))) {
      if (doctor.status !== 'approved') {
          res.status(401); 
          throw new Error('Your account is restricted. Contact support.');
      }
      
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString(); 
      doctor.loginOtp = generatedOtp;
      doctor.loginOtpExpire = Date.now() + 10 * 60 * 1000;
      await doctor.save();

      const emailHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>MediMeet Doctor Portal Login</title>
      </head>
      <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 40px 20px;">
              <tr>
                  <td align="center">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; max-width: 600px;">
                          <tr>
                              <td style="background: linear-gradient(135deg, #1e293b 0%, #0aa87e 100%); padding: 30px 40px; text-align: center;">
                                  <h1 style="color: #ffffff; margin: 0; font-size: 24px;">MediMeet Provider Portal</h1>
                              </td>
                          </tr>
                          <tr>
                              <td style="padding: 40px;">
                                  <h2 style="color: #1a2e2b; margin: 0 0 20px 0;">Doctor Authentication</h2>
                                  <p style="color: #4a6560; font-size: 16px;">
                                      Hello Dr. <strong>${doctor.name}</strong>,<br><br>
                                      Please use the secure OTP below to access your MediMeet dashboard.
                                  </p>
                                  <div style="background-color: #f5f8f7; border: 2px dashed #0aa87e; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                                      <span style="font-size: 42px; font-weight: 800; color: #0aa87e; letter-spacing: 8px;">${generatedOtp}</span>
                                  </div>
                              </td>
                          </tr>
                      </table>
                  </td>
              </tr>
          </table>
      </body>
      </html>
      `;

      try {
        await sendEmail({
          email: doctor.email,
          subject: 'MediMeet Provider Portal - Secure Login',
          message: `Your doctor login OTP is ${generatedOtp}.`, 
          html: emailHtml 
        });
        
        res.json({ message: "OTP sent to your registered email." });
      } catch (error) {
        doctor.loginOtp = undefined;
        doctor.loginOtpExpire = undefined;
        await doctor.save();
        res.status(500);
        throw new Error('Email could not be sent. Please try again.');
      }

    } else {
      res.status(401);
      throw new Error('Invalid email or password. If you recently applied, please wait for admin approval.');
    }
});

const verifyDoctorOtp = asyncHandler(async (req, res) => {
    const email = req.body.email?.trim().toLowerCase();
    const otp = req.body.otp?.trim();
const doctor = await Doctor.findOne({ email }).select('+password');
    if (!doctor) {
      res.status(401);
      throw new Error('Invalid or expired OTP');
    }

    const dbOtp = doctor.loginOtp ? String(doctor.loginOtp).trim() : '';
    const inputOtp = otp ? String(otp).trim() : '';
    const expiryTime = doctor.loginOtpExpire ? new Date(doctor.loginOtpExpire).getTime() : 0;
    const isOtpValid = dbOtp === inputOtp;
    const isNotExpired = expiryTime > Date.now();
  
    if (isOtpValid && isNotExpired) {
      doctor.loginOtp = undefined;
      doctor.loginOtpExpire = undefined;
      await doctor.save();
      res.json({ 
          _id: doctor._id, 
          name: doctor.name, 
          email: doctor.email, 
          token: generateToken(doctor._id),
          type: 'doctor' 
      });
    } else {
      res.status(401); 
      if (!isNotExpired) {
        throw new Error('OTP expired. Please login again.');
      }
      throw new Error('Invalid OTP');
    }
});

const requestDoctorPasswordResetOtp = asyncHandler(async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();

  if (!email) {
    res.status(400);
    throw new Error('Doctor email is required.');
  }

  const doctor = await Doctor.findOne({ email });
  if (!doctor || doctor.status !== 'approved') {
    res.status(404);
    throw new Error('No approved doctor account was found with this email.');
  }

  const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
  doctor.resetPasswordOtp = generatedOtp;
  doctor.resetPasswordOtpExpire = Date.now() + 10 * 60 * 1000;
  await doctor.save();

  const emailHtml = `
  <!DOCTYPE html>
  <html lang="en">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>MediMeet Doctor Password Reset</title>
  </head>
  <body style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; margin: 0; padding: 0;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="padding: 40px 20px;">
          <tr>
              <td align="center">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; max-width: 600px;">
                      <tr>
                          <td style="background: linear-gradient(135deg, #1e293b 0%, #0aa87e 100%); padding: 30px 40px; text-align: center;">
                              <h1 style="color: #ffffff; margin: 0; font-size: 24px;">MediMeet Provider Portal</h1>
                          </td>
                      </tr>
                      <tr>
                          <td style="padding: 40px;">
                              <h2 style="color: #1a2e2b; margin: 0 0 20px 0;">Password Reset Code</h2>
                              <p style="color: #4a6560; font-size: 16px;">
                                  Hello Dr. <strong>${doctor.name}</strong>,<br><br>
                                  Use the OTP below to reset your doctor portal password.
                              </p>
                              <div style="background-color: #f5f8f7; border: 2px dashed #0aa87e; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                                  <span style="font-size: 42px; font-weight: 800; color: #0aa87e; letter-spacing: 8px;">${generatedOtp}</span>
                              </div>
                              <p style="color: #4a6560; font-size: 14px; margin: 0;">This code will expire in 10 minutes. If you did not request this, you can ignore this email.</p>
                          </td>
                      </tr>
                  </table>
              </td>
          </tr>
      </table>
  </body>
  </html>
  `;

  try {
    await sendEmail({
      email: doctor.email,
      subject: 'MediMeet Provider Portal - Password Reset OTP',
      message: `Your doctor password reset OTP is ${generatedOtp}. It will expire in 10 minutes.`,
      html: emailHtml
    });

    res.json({ message: 'Password reset OTP sent to your registered email.' });
  } catch (error) {
    doctor.resetPasswordOtp = undefined;
    doctor.resetPasswordOtpExpire = undefined;
    await doctor.save();
    res.status(500);
    throw new Error('Email could not be sent. Please try again.');
  }
});

const verifyDoctorPasswordResetOtp = asyncHandler(async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const otp = req.body.otp?.trim();

  if (!email || !otp) {
    res.status(400);
    throw new Error('Email and OTP are required.');
  }

  const doctor = await Doctor.findOne({ email });
  if (!doctor) {
    res.status(401);
    throw new Error('Invalid or expired OTP.');
  }

  const dbOtp = doctor.resetPasswordOtp ? String(doctor.resetPasswordOtp).trim() : '';
  const inputOtp = String(otp).trim();
  const expiryTime = doctor.resetPasswordOtpExpire ? new Date(doctor.resetPasswordOtpExpire).getTime() : 0;

  if (dbOtp !== inputOtp || expiryTime <= Date.now()) {
    res.status(401);
    throw new Error(expiryTime <= Date.now() ? 'OTP expired. Please request a new one.' : 'Invalid OTP.');
  }

  res.json({ verified: true, message: 'OTP verified. You can now set a new password.' });
});

const resetDoctorPassword = asyncHandler(async (req, res) => {
  const email = req.body.email?.trim().toLowerCase();
  const otp = req.body.otp?.trim();
  const newPassword = req.body.newPassword;

  if (!email || !otp || !newPassword) {
    res.status(400);
    throw new Error('Email, OTP, and new password are required.');
  }

  if (String(newPassword).length < 6) {
    res.status(400);
    throw new Error('New password must be at least 6 characters.');
  }

  const doctor = await Doctor.findOne({ email }).select('+password');
  if (!doctor) {
    res.status(401);
    throw new Error('Invalid or expired OTP.');
  }

  const dbOtp = doctor.resetPasswordOtp ? String(doctor.resetPasswordOtp).trim() : '';
  const inputOtp = String(otp).trim();
  const expiryTime = doctor.resetPasswordOtpExpire ? new Date(doctor.resetPasswordOtpExpire).getTime() : 0;

  if (dbOtp !== inputOtp || expiryTime <= Date.now()) {
    res.status(401);
    throw new Error(expiryTime <= Date.now() ? 'OTP expired. Please request a new one.' : 'Invalid OTP.');
  }

  doctor.password = newPassword;
  doctor.resetPasswordOtp = undefined;
  doctor.resetPasswordOtpExpire = undefined;
  doctor.loginOtp = undefined;
  doctor.loginOtpExpire = undefined;
  await doctor.save();

  res.json({ success: true, message: 'Password updated successfully. Please sign in with your new password.' });
});

const forgotPassword = (req, res) => res.send("Forgot Password logic");
const resetPassword = (req, res) => res.send("Reset Password logic");
const getDoctorProfile = getUserProfile;
const updateDoctorPhoto = updateUserPhoto;
const removeDoctorPhoto = removeUserPhoto;

module.exports = { 
  registerUser, loginUser, verifyPatientOtp, forgotPassword, resetPassword, 
  applyDoctor, loginDoctor, verifyDoctorOtp, getDoctorProfile, 
  requestDoctorPasswordResetOtp, verifyDoctorPasswordResetOtp, resetDoctorPassword,
  updateDoctorPhoto, removeDoctorPhoto, getUserProfile, 
  updateUserPhoto, removeUserPhoto, updateProfile, toggleTwoFactor, changePassword
};
