const {
  getUserModel,
  getAppointmentModel,
  getAIAnalysisModel,
  getReportModel,
} = require("../utils/modelHelper.js");

// Simple in-memory cache with TTL
const statsCache = {
  data: null,
  timestamp: null,
  ttl: 5 * 60 * 1000, // 5 minutes in milliseconds
};

const clearStatsCache = () => {
  statsCache.data = null;
  statsCache.timestamp = null;
};

const getUsers = async (req, res, next) => {
  try {
    const { role, search } = req.query;
    const User = getUserModel();
    let query = {};

    if (role) {
      query.role = role;
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    let users = await User.find(query);

    // Remove passwords and sort
    users = users.map((u) => {
      const { password, ...userWithoutPassword } = u;
      return userWithoutPassword;
    });

    users.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    users = users.slice(0, 100);

    res.json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const User = getUserModel();
    let user = await User.findById(req.params.id);

    // Remove password
    if (user && user.password) {
      const { password, ...userWithoutPassword } = user;
      user = userWithoutPassword;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowedUpdates = [
      "name",
      "phone",
      "dateOfBirth",
      "address",
      "specialization",
      "licenseNumber",
      "bloodGroup",
      "emergencyContact",
      "isActive",
      "role",
    ];
    const updates = Object.keys(req.body);
    const isValidOperation = updates.every((update) =>
      allowedUpdates.includes(update)
    );

    if (!isValidOperation) {
      return res.status(400).json({ message: "Invalid updates" });
    }

    const User = getUserModel();
    let user = await User.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    // Remove password
    if (user && user.password) {
      const { password, ...userWithoutPassword } = user;
      user = userWithoutPassword;
    }

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Don't allow self-deletion
    if (id === req.user.id) {
      return res
        .status(400)
        .json({ message: "Cannot delete your own account" });
    }

    const User = getUserModel();
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      message: "User deleted",
    });
  } catch (error) {
    next(error);
  }
};

const getDashboardStats = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    // Check cache for admin stats (same for all admins)
    if (role === "admin") {
      const now = Date.now();
      if (
        statsCache.data &&
        statsCache.timestamp &&
        now - statsCache.timestamp < statsCache.ttl
      ) {
        return res.json({
          success: true,
          stats: statsCache.data,
        });
      }
    }

    let stats = {};

    const User = getUserModel();
    const Appointment = getAppointmentModel();
    const AIAnalysis = getAIAnalysisModel();

    if (role === "admin") {
      // Use efficient aggregation/counting instead of loading all users
      // For in-memory store, we still need to count, but we can optimize
      const useInMemory = typeof User.countDocuments !== "function";

      let totalUsers,
        totalPatients,
        totalDoctors,
        totalAppointments,
        totalAnalyses,
        pendingAppointments;

      if (useInMemory) {
        // In-memory store: use efficient filtering
        const allUsers = await User.find({});
        totalUsers = allUsers.length;
        totalPatients = allUsers.filter((u) => u.role === "patient").length;
        totalDoctors = allUsers.filter((u) => u.role === "doctor").length;

        const allAppointments = await Appointment.find({});
        totalAppointments = allAppointments.length;
        pendingAppointments = allAppointments.filter(
          (a) => a.status === "pending"
        ).length;

        const allAnalyses = await AIAnalysis.find({});
        totalAnalyses = allAnalyses.length;
      } else {
        // MongoDB: use efficient countDocuments
        totalUsers = await User.countDocuments();
        totalPatients = await User.countDocuments({ role: "patient" });
        totalDoctors = await User.countDocuments({ role: "doctor" });
        totalAppointments = await Appointment.countDocuments();
        totalAnalyses = await AIAnalysis.countDocuments();
        pendingAppointments = await Appointment.countDocuments({
          status: "pending",
        });
      }

      stats = {
        totalUsers,
        totalPatients,
        totalDoctors,
        totalAppointments,
        totalAnalyses,
        pendingAppointments,
      };

      // Cache admin stats
      statsCache.data = stats;
      statsCache.timestamp = Date.now();
    } else if (role === "doctor") {
      const useInMemory = typeof Appointment.countDocuments !== "function";

      let myAppointments,
        pendingAppointments,
        completedAppointments,
        myAnalyses,
        myPatients;

      if (useInMemory) {
        const allAppointments = await Appointment.find({ doctor: userId });
        myAppointments = allAppointments.length;
        pendingAppointments = allAppointments.filter(
          (a) => a.status === "pending"
        ).length;
        completedAppointments = allAppointments.filter(
          (a) => a.status === "completed"
        ).length;

        const uniquePatients = new Set(
          allAppointments.map(
            (a) =>
              a.patient?._id?.toString() || a.patient?.toString() || a.patient
          )
        );
        myPatients = uniquePatients.size;

        const allAnalyses = await AIAnalysis.find({ doctor: userId });
        myAnalyses = allAnalyses.length;
      } else {
        myAppointments = await Appointment.countDocuments({
          doctor: userId,
        });
        pendingAppointments = await Appointment.countDocuments({
          doctor: userId,
          status: "pending",
        });
        completedAppointments = await Appointment.countDocuments({
          doctor: userId,
          status: "completed",
        });
        myAnalyses = await AIAnalysis.countDocuments({ doctor: userId });
        const patients = await Appointment.distinct("patient", {
          doctor: userId,
        });
        myPatients = patients.length;
      }

      stats = {
        myAppointments,
        pendingAppointments,
        completedAppointments,
        myAnalyses,
        totalPatients: myPatients,
      };
    } else if (role === "patient") {
      const Report = getReportModel();
      const useInMemory = typeof Appointment.countDocuments !== "function";

      let myAppointments, upcomingAppointments, myReports, myAnalyses;

      if (useInMemory) {
        const allAppointments = await Appointment.find({ patient: userId });
        myAppointments = allAppointments.length;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        upcomingAppointments = allAppointments.filter((a) => {
          const aptDate = new Date(a.appointmentDate);
          return (
            (a.status === "pending" || a.status === "confirmed") &&
            aptDate >= today
          );
        }).length;

        const allReports = await Report.find({ patient: userId });
        myReports = allReports.length;

        const allAnalyses = await AIAnalysis.find({ patient: userId });
        myAnalyses = allAnalyses.length;
      } else {
        myAppointments = await Appointment.countDocuments({
          patient: userId,
        });
        upcomingAppointments = await Appointment.countDocuments({
          patient: userId,
          status: { $in: ["pending", "confirmed"] },
          appointmentDate: { $gte: new Date() },
        });
        myReports = await Report.countDocuments({ patient: userId });
        myAnalyses = await AIAnalysis.countDocuments({ patient: userId });
      }

      stats = {
        myAppointments,
        upcomingAppointments,
        myReports,
        myAnalyses,
      };
    }

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    next(error);
  }
};

const getHealthTrends = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;

    const AIAnalysis = getAIAnalysisModel();
    let analyses = [];

    // For admin, get all analyses; for others, get their own
    if (role === "admin") {
      analyses = await AIAnalysis.find({});
    } else {
      analyses = await AIAnalysis.find({ patient: userId });
    }

    // Sort by creation date
    analyses.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const trends = analyses.map((analysis) => ({
      date: analysis.createdAt,
      severity: analysis.aiResponse?.severity || "low",
      confidence: analysis.aiResponse?.confidence || 0,
      accuracy: analysis.accuracy || null,
      diagnosisCount: analysis.aiResponse?.possibleDiagnosis?.length || 0,
    }));

    res.json({
      success: true,
      trends,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  getDashboardStats,
  getHealthTrends,
  clearStatsCache,
};
