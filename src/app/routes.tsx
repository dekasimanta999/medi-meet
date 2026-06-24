import { createBrowserRouter } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { DoctorDashboard } from "./pages/doctor-page/DoctorDashboard";
import { PatientDashboard } from "./pages/Patient-page/PatientDashboard";
import { NotFound } from "./pages/NotFound";
import { RegisterPage } from "./pages/Register";
import { ApplyDoctor } from "./pages/doctor-page/ApplyDoctor";
import { ForgotPassword } from "./pages/ForgotPassword";
import { AdminDashboard } from "./pages/admin-page/AdminDashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: LoginPage,
  },
  {
    path: "/register",
    Component: RegisterPage,
  },
  {
    path: "/forgot-password",
    Component: ForgotPassword,
  },
  {
    path: "/apply-doctor",
    Component: ApplyDoctor,
  },
  {
    path: "/doctor-dashboard",
    Component: DoctorDashboard,
  },
  {
    path: "/patient-dashboard",
    Component: PatientDashboard,
  },
  {
    path: "/admin/dashboard",
    Component: AdminDashboard,
  },
  {
    path: "*",
    Component: NotFound,
  },
]);
