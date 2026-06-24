const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const MedicalRecord = require('../models/MedicalRecord');
const Appointment = require('../models/Appointment');

const consultableAppointmentQuery = (doctorId, patientId) => ({
  doctorId,
  ...(patientId ? { patientId } : {}),
  $or: [
    { paymentStatus: 'paid' },
    { status: { $in: ['confirmed', 'completed'] } }
  ]
});

const getAccessiblePatientIds = async (doctorId) =>
  Appointment.distinct('patientId', consultableAppointmentQuery(doctorId));

const canDoctorAccessPatient = async (doctorId, patientId) =>
  Boolean(await Appointment.exists(consultableAppointmentQuery(doctorId, patientId)));

// @desc    Get all medical records for doctors (with filtering)
// @route   GET /api/doctor-records
// @access  Private (doctor)
const getAllMedicalRecords = asyncHandler(async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', type = '', patientId = '' } = req.query;
    const requestedPatientId = String(patientId || '').trim();
    const accessiblePatientIds = await getAccessiblePatientIds(req.user._id);
    
    // Build query
    const query = { patientId: { $in: accessiblePatientIds } };
    
    // If searching by patient ID
    if (requestedPatientId) {
      if (!mongoose.Types.ObjectId.isValid(requestedPatientId)) {
        return res.status(400).json({ message: 'Invalid patient id' });
      }

      const canAccess = accessiblePatientIds.some((id) => String(id) === requestedPatientId);
      if (!canAccess) {
        return res.status(200).json({
          records: [],
          pagination: {
            currentPage: Number(page),
            totalPages: 0,
            totalRecords: 0,
            hasNext: false
          }
        });
      }

      query.patientId = requestedPatientId;
    }
    
    // If searching by type
    if (type) {
      query.type = type;
    }
    
    // If searching by text
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { doctor: { $regex: search, $options: 'i' } },
        { notes: { $regex: search, $options: 'i' } }
      ];
    }
    
    // Pagination
    const numericPage = Math.max(Number(page) || 1, 1);
    const numericLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const skip = (numericPage - 1) * numericLimit;
    
    const [records, total] = await Promise.all([
      MedicalRecord.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(numericLimit)
        .lean(),
      MedicalRecord.countDocuments(query)
    ]);
    
    // Filter by type if specified
    let filteredRecords = records;
    if (type) {
      filteredRecords = records.filter(record => record.type === type);
    }
    
    res.status(200).json({
      records: filteredRecords,
      pagination: {
        currentPage: numericPage,
        totalPages: Math.ceil(total / numericLimit),
        totalRecords: total,
        hasNext: numericPage * numericLimit < total
      }
    });
  } catch (error) {
    console.error('Error fetching medical records:', error);
    res.status(500).json({ message: 'Failed to fetch medical records' });
  }
});

// @desc    Get medical record by ID
// @route   GET /api/doctor-records/:id
// @access  Private (doctor)
const getMedicalRecordById = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({ message: 'Record ID is required' });
    }
    
    const record = await MedicalRecord.findById(id).lean();
    
    if (!record) {
      return res.status(404).json({ message: 'Medical record not found' });
    }

    if (!(await canDoctorAccessPatient(req.user._id, record.patientId))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    res.status(200).json(record);
  } catch (error) {
    console.error('Error fetching medical record:', error);
    res.status(500).json({ message: 'Failed to fetch medical record' });
  }
});

// @desc    Get medical record file for doctors
// @route   GET /api/doctor-records/:id/file
// @access  Private (doctor)
const getMedicalRecordFile = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const download = req.query.download === '1' || req.query.download === 'true';
    
    if (!id) {
      return res.status(400).json({ message: 'Record ID is required' });
    }
    
    const record = await MedicalRecord.findById(id).lean();
    
    if (!record || !record.storedFileName) {
      return res.status(404).json({ message: 'File not found' });
    }

    if (!(await canDoctorAccessPatient(req.user._id, record.patientId))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const path = require('path');
    const fs = require('fs');
    const filePath = path.join(__dirname, '../private/medical_records', record.storedFileName);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found on server' });
    }
    
    // Security check - ensure file path is within medical_records directory
    if (!filePath.startsWith(path.join(__dirname, '../private/medical_records'))) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    const safeFileName = (record.originalFileName || 'medical-record').replace(/[^\w.-]/g, '_');
    
    res.setHeader('Content-Type', record.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `${download ? 'attachment' : 'inline'}; filename="${safeFileName}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
  } catch (error) {
    console.error('Error serving medical record file:', error);
    res.status(500).json({ message: 'Failed to serve file' });
  }
});

// @desc    Get medical records statistics
// @route   GET /api/doctor-records/stats
// @access  Private (doctor)
const getMedicalRecordsStats = asyncHandler(async (req, res) => {
  try {
    const accessiblePatientIds = await getAccessiblePatientIds(req.user._id);
    const stats = await MedicalRecord.aggregate([
      {
        $match: { patientId: { $in: accessiblePatientIds } }
      },
      {
        $facet: {
          patientStats: [
            {
              $group: {
                _id: '$patientId',
                totalRecords: { $sum: 1 }
              }
            }
          ],
          typeStats: [
            {
              $group: {
                _id: '$type',
                count: { $sum: 1 }
              }
            }
          ],
          totals: [
            {
              $count: 'totalRecords'
            }
          ]
        }
      }
    ]);
    
    const patientStats = stats[0]?.patientStats || [];
    const typeStats = stats[0]?.typeStats || [];
    const totalRecords = stats[0]?.totals?.[0]?.totalRecords || 0;
    
    res.status(200).json({
      totalRecords,
      patientBreakdown: patientStats.map(stat => ({
        patientId: stat._id,
        totalRecords: stat.totalRecords
      })),
      typeBreakdown: typeStats.map(stat => ({
        type: stat._id,
        count: stat.count
      }))
    });
  } catch (error) {
    console.error('Error fetching medical records stats:', error);
    res.status(500).json({ message: 'Failed to fetch statistics' });
  }
});

module.exports = {
  getAllMedicalRecords,
  getMedicalRecordById,
  getMedicalRecordFile,
  getMedicalRecordsStats
};
