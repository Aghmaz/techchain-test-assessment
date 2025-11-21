import { useEffect, useState } from "react";
import { appointmentService } from "../../services/appointmentService";
import { userService } from "../../services/userService";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "../../components/Card";
import { Button } from "../../components/Button";
import { Input } from "../../components/Input";
import { Label } from "../../components/Label";
import { format } from "date-fns";
import { Calendar, Clock, User, X } from "lucide-react";

export const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    doctor: "",
    appointmentDate: "",
    appointmentTime: "",
    reason: "",
    symptoms: "",
  });
  const [errors, setErrors] = useState({});
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    fetchAppointments();
    fetchDoctors();
  }, []);

  const fetchAppointments = async () => {
    try {
      const { appointments: data } = await appointmentService.getAll();
      setAppointments(data);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDoctors = async () => {
    try {
      const { users } = await userService.getAll({ role: "doctor" });
      setDoctors(users);
    } catch (error) {
      console.error("Failed to fetch doctors:", error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Doctor selection validation
    if (!formData.doctor) {
      newErrors.doctor = "Doctor selection is required";
    }

    // Date validation - must be in the future
    if (!formData.appointmentDate) {
      newErrors.appointmentDate = "Date is required";
    } else {
      const selectedDate = new Date(formData.appointmentDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate <= today) {
        newErrors.appointmentDate = "Date must be in the future";
      }
    }

    // Time validation - must be during business hours (9 AM - 5 PM)
    if (!formData.appointmentTime) {
      newErrors.appointmentTime = "Time is required";
    } else {
      const [hours, minutes] = formData.appointmentTime.split(":").map(Number);
      const hour = hours + minutes / 60;
      if (hour < 9 || hour >= 17) {
        newErrors.appointmentTime =
          "Time must be during business hours (9 AM - 5 PM)";
      }
    }

    // Reason validation - must be at least 10 characters
    if (!formData.reason) {
      newErrors.reason = "Reason is required";
    } else if (formData.reason.length < 10) {
      newErrors.reason = "Reason must be at least 10 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: "" });
    }
    // Clear success message when form changes
    if (successMessage) {
      setSuccessMessage("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await appointmentService.create(formData);
      setShowForm(false);
      setFormData({
        doctor: "",
        appointmentDate: "",
        appointmentTime: "",
        reason: "",
        symptoms: "",
      });
      setErrors({});
      setSuccessMessage("Appointment booked successfully!");
      setTimeout(() => setSuccessMessage(""), 5000);
      fetchAppointments();
    } catch (error) {
      alert(error.response?.data?.message || "Failed to create appointment");
    }
  };

  const handleCancel = async (id) => {
    if (window.confirm("Are you sure you want to cancel this appointment?")) {
      try {
        await appointmentService.update(id, { status: "cancelled" });
        fetchAppointments();
      } catch (error) {
        alert(error.response?.data?.message || "Failed to cancel appointment");
      }
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "confirmed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "completed":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">My Appointments</h1>
          <p className="text-muted-foreground mt-2">
            Manage your medical appointments
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>Book Appointment</Button>
      </div>

      {successMessage && (
        <div
          className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative"
          role="alert"
        >
          <span className="block sm:inline">{successMessage}</span>
        </div>
      )}

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>Book New Appointment</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="doctor">Doctor</Label>
                  <select
                    id="doctor"
                    className={`flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm ${
                      errors.doctor ? "border-red-500" : "border-input"
                    }`}
                    value={formData.doctor}
                    onChange={(e) =>
                      handleFieldChange("doctor", e.target.value)
                    }
                  >
                    <option value="">Select a doctor</option>
                    {doctors.map((doctor) => (
                      <option key={doctor._id} value={doctor._id}>
                        {doctor.name}{" "}
                        {doctor.specialization && `- ${doctor.specialization}`}
                      </option>
                    ))}
                  </select>
                  {errors.doctor && (
                    <p className="text-sm text-red-500">{errors.doctor}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appointmentDate">Date</Label>
                  <Input
                    id="appointmentDate"
                    type="date"
                    value={formData.appointmentDate}
                    onChange={(e) =>
                      handleFieldChange("appointmentDate", e.target.value)
                    }
                    min={new Date().toISOString().split("T")[0]}
                    className={errors.appointmentDate ? "border-red-500" : ""}
                  />
                  {errors.appointmentDate && (
                    <p className="text-sm text-red-500">
                      {errors.appointmentDate}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="appointmentTime">Time</Label>
                  <Input
                    id="appointmentTime"
                    type="time"
                    value={formData.appointmentTime}
                    onChange={(e) =>
                      handleFieldChange("appointmentTime", e.target.value)
                    }
                    className={errors.appointmentTime ? "border-red-500" : ""}
                  />
                  {errors.appointmentTime && (
                    <p className="text-sm text-red-500">
                      {errors.appointmentTime}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason</Label>
                  <Input
                    id="reason"
                    value={formData.reason}
                    onChange={(e) =>
                      handleFieldChange("reason", e.target.value)
                    }
                    placeholder="Brief reason for visit"
                    className={errors.reason ? "border-red-500" : ""}
                  />
                  {errors.reason && (
                    <p className="text-sm text-red-500">{errors.reason}</p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="symptoms">Symptoms (Optional)</Label>
                <textarea
                  id="symptoms"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={formData.symptoms}
                  onChange={(e) =>
                    handleFieldChange("symptoms", e.target.value)
                  }
                  placeholder="Describe your symptoms..."
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  type="submit"
                  disabled={
                    Object.keys(errors).some((key) => errors[key]) ||
                    !formData.doctor ||
                    !formData.appointmentDate ||
                    !formData.appointmentTime ||
                    !formData.reason ||
                    formData.reason.length < 10
                  }
                >
                  Book Appointment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setErrors({});
                    setFormData({
                      doctor: "",
                      appointmentDate: "",
                      appointmentTime: "",
                      reason: "",
                      symptoms: "",
                    });
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {appointments.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <p className="text-muted-foreground">No appointments found</p>
            </CardContent>
          </Card>
        ) : (
          appointments.map((appointment) => (
            <Card key={appointment._id}>
              <CardContent className="pt-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <span className="font-semibold">
                        Dr. {appointment.doctor?.name}
                      </span>
                      {appointment.doctor?.specialization && (
                        <span className="text-sm text-muted-foreground">
                          - {appointment.doctor.specialization}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <div className="flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>
                          {format(
                            new Date(appointment.appointmentDate),
                            "MMM dd, yyyy"
                          )}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1">
                        <Clock className="h-4 w-4" />
                        <span>{appointment.appointmentTime}</span>
                      </div>
                    </div>
                    {appointment.reason && (
                      <p className="text-sm">{appointment.reason}</p>
                    )}
                    {appointment.symptoms && (
                      <p className="text-sm text-muted-foreground">
                        Symptoms: {appointment.symptoms}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        appointment.status
                      )}`}
                    >
                      {appointment.status}
                    </span>
                    {appointment.status !== "cancelled" &&
                      appointment.status !== "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCancel(appointment._id)}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Cancel
                        </Button>
                      )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
