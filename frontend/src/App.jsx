import { useEffect, useState } from "react";
import { Routes, Route, Outlet, useLocation } from "react-router-dom";
import { LayoutDashboard, BookOpen, Receipt, Bell, Megaphone, UserRound, Users, GraduationCap, ShieldCheck, KeyRound, PlayCircle, Layers, CalendarDays, Wallet, Landmark, MessageSquare, PhoneCall, Mail, ShoppingCart, Activity, Settings, ListChecks, FileText, Library } from "lucide-react";
import Header from "./components/Header";
import Footer from "./components/Footer";
import { CartDrawer, MobileCartBar } from "./components/CartPanel";
import { api } from "./lib/api";
import { useApp } from "./context/AppContext";
import Home from "./pages/public/Home";
import ProgramPage from "./pages/public/ProgramPage";
import CourseDetail from "./pages/public/CourseDetail";
import { Faculty, TeacherProfile } from "./pages/public/Faculty";
import Fees from "./pages/public/Fees";
import { About, Contact, Legal, HowToEnrol } from "./pages/public/InfoPages";
import { Login, Register } from "./pages/public/Auth";
import Checkout from "./pages/public/Checkout";
import NotFound from "./pages/public/NotFound";
import PortalLayout from "./pages/portal/PortalLayout";
import { Profile, Notifications } from "./pages/portal/Common";
import { StudentHome, MyCourses, Learn, Orders, StudentAnnouncements } from "./pages/portal/student/Student";
import { TeacherHome, TeacherCourses, TeacherCourse, TeacherStudents, TeacherAnnouncements } from "./pages/portal/teacher/Teacher";
import { AdminHome, AdminOrders, AdminAccess, AdminUsers, AdminCourses, AdminLessons, AdminSettings, simple } from "./pages/portal/admin/Admin";
import { OptionsCtx } from "./pages/portal/admin/options";

function PublicLayout() {
  return (<><Header /><main id="main"><Outlet /></main><Footer /><CartDrawer /><MobileCartBar /></>);
}

/** Saves every page visit to the database (activity_logs → page.view). */
function Tracker() {
  const loc = useLocation();
  useEffect(() => {
    const t = setTimeout(() => api.post("/track", { path: loc.pathname + loc.search, title: document.title, referrer: document.referrer || null }).catch(() => {}), 300);
    if (!loc.hash) window.scrollTo(0, 0);
    return () => clearTimeout(t);
  }, [loc.pathname, loc.search]); // eslint-disable-line
  return null;
}

function AdminShell(props) {
  const { user } = useApp();
  const [opts, setOpts] = useState({});
  const loc = useLocation();
  useEffect(() => { if (user?.role === "admin") api.get("/admin/options").then((r) => setOpts(r.data)).catch(() => {}); }, [user, loc.pathname]);
  return <OptionsCtx.Provider value={opts}><PortalLayout {...props} /></OptionsCtx.Provider>;
}

const studentNav = [{ items: [["/student", "Dashboard", LayoutDashboard], ["/student/courses", "My courses", BookOpen], ["/student/orders", "Orders & payments", Receipt], ["/student/announcements", "Announcements", Megaphone], ["/student/notifications", "Notifications", Bell], ["/student/profile", "Profile & password", UserRound]] }];
const teacherNav = [{ items: [["/teacher", "Dashboard", LayoutDashboard], ["/teacher/courses", "My courses & lectures", PlayCircle], ["/teacher/students", "My students", Users], ["/teacher/announcements", "Announcements", Megaphone], ["/teacher/notifications", "Notifications", Bell], ["/teacher/profile", "Profile & password", UserRound]] }];
const adminNav = [
  { items: [["/admin", "Dashboard", LayoutDashboard]] },
  { group: "Admissions", items: [["/admin/orders", "Orders & payment review", Receipt], ["/admin/access", "Course access", KeyRound], ["/admin/payments", "Payments", Wallet], ["/admin/carts", "Carts", ShoppingCart], ["/admin/order-items", "Order items", ListChecks]] },
  { group: "People", items: [["/admin/students", "Students", GraduationCap], ["/admin/teachers", "Teachers", Users], ["/admin/admins", "Administrators", ShieldCheck]] },
  { group: "Academics", items: [["/admin/programs", "Programmes", Library], ["/admin/levels", "Levels", Layers], ["/admin/courses", "Courses", BookOpen], ["/admin/lessons", "Lessons & videos", PlayCircle], ["/admin/sessions", "Exam sessions", CalendarDays], ["/admin/progress", "Lesson progress", Activity]] },
  { group: "Communication", items: [["/admin/announcements", "Announcements", Megaphone], ["/admin/notifications-sent", "User notifications", Bell], ["/admin/messages", "Contact messages", MessageSquare], ["/admin/inquiries", "Inquiries", PhoneCall], ["/admin/subscribers", "Subscribers", Mail]] },
  { group: "System", items: [["/admin/payment-accounts", "Payment accounts", Landmark], ["/admin/settings", "Website settings", Settings], ["/admin/activity", "Activity log", FileText], ["/admin/notifications", "My notifications", Bell], ["/admin/profile", "My profile", UserRound]] },
];

export default function App() {
  return (
    <>
      <Tracker />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/acca" element={<ProgramPage slug="acca" />} />
          <Route path="/ca" element={<ProgramPage slug="ca" />} />
          <Route path="/programs/:slug" element={<ProgramPage />} />
          <Route path="/course/:slug" element={<CourseDetail />} />
          <Route path="/faculty" element={<Faculty />} />
          <Route path="/faculty/:username" element={<TeacherProfile />} />
          <Route path="/fees" element={<Fees />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/how-to-enrol" element={<HowToEnrol />} />
          <Route path="/terms" element={<Legal kind="terms" />} />
          <Route path="/privacy" element={<Legal kind="privacy" />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/student" element={<PortalLayout role="student" nav={studentNav} />}>
          <Route index element={<StudentHome />} />
          <Route path="courses" element={<MyCourses />} />
          <Route path="learn/:slug" element={<Learn />} />
          <Route path="orders" element={<Orders />} />
          <Route path="announcements" element={<StudentAnnouncements />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/teacher" element={<PortalLayout role="teacher" nav={teacherNav} />}>
          <Route index element={<TeacherHome />} />
          <Route path="courses" element={<TeacherCourses />} />
          <Route path="courses/:id" element={<TeacherCourse />} />
          <Route path="students" element={<TeacherStudents />} />
          <Route path="announcements" element={<TeacherAnnouncements />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        <Route path="/admin" element={<AdminShell role="admin" nav={adminNav} />}>
          <Route index element={<AdminHome />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="access" element={<AdminAccess />} />
          <Route path="payments" element={<simple.payments />} />
          <Route path="carts" element={<simple.carts />} />
          <Route path="order-items" element={<simple.orderItems />} />
          <Route path="students" element={<AdminUsers role="student" />} />
          <Route path="teachers" element={<AdminUsers role="teacher" />} />
          <Route path="admins" element={<AdminUsers role="admin" />} />
          <Route path="programs" element={<simple.programs />} />
          <Route path="levels" element={<simple.levels />} />
          <Route path="courses" element={<AdminCourses />} />
          <Route path="lessons" element={<AdminLessons />} />
          <Route path="sessions" element={<simple.sessions />} />
          <Route path="progress" element={<simple.progress />} />
          <Route path="announcements" element={<simple.announcements />} />
          <Route path="notifications-sent" element={<simple.notifications />} />
          <Route path="messages" element={<simple.messages />} />
          <Route path="inquiries" element={<simple.inquiries />} />
          <Route path="subscribers" element={<simple.subscribers />} />
          <Route path="payment-accounts" element={<simple.accounts />} />
          <Route path="settings" element={<AdminSettings />} />
          <Route path="activity" element={<simple.activity />} />
          <Route path="notifications" element={<Notifications />} />
          <Route path="profile" element={<Profile />} />
        </Route>
      </Routes>
    </>
  );
}
