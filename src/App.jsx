import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth/AuthContext.jsx';
import AppLayout from './components/AppLayout.jsx';
import { LoadingState, EmptyState } from './components/ui.jsx';
import { LoginPage, SelectSchoolPage, ForgotPasswordPage, ResetPasswordPage, VerifyEmailPage, AccountPage } from './pages/auth.jsx';

// Page groups are code-split so the first load stays small.
const L = (loader, name) => lazy(() => loader().then((m) => ({ default: m[name] })));
const fees = () => import('./pages/fees.jsx');
const attendance = () => import('./pages/attendance.jsx');
const people = () => import('./pages/people.jsx');
const academics = () => import('./pages/academics.jsx');
const exams = () => import('./pages/exams.jsx');
const admin = () => import('./pages/admin.jsx');
const family = () => import('./pages/family.jsx');
const platform = () => import('./pages/platform.jsx');
const services = () => import('./pages/services.jsx');
const communication = () => import('./pages/communication.jsx');
const reports = () => import('./pages/reports.jsx');

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const P = {
  FeeDashboard: L(fees, 'FeeDashboard'),
  CollectFee: L(fees, 'CollectFee'),
  Invoices: L(fees, 'Invoices'),
  InvoiceDetail: L(fees, 'InvoiceDetail'),
  Payments: L(fees, 'Payments'),
  Receipt: L(fees, 'ReceiptPage'),
  Defaulters: L(fees, 'Defaulters'),
  Reminders: L(fees, 'Reminders'),
  FeeSetup: L(fees, 'FeeSetup'),
  FeeReports: L(fees, 'FeeReports'),
  AttendanceToday: L(attendance, 'AttendanceToday'),
  MarkAttendance: L(attendance, 'MarkAttendance'),
  LeaveRequests: L(attendance, 'LeaveRequests'),
  AttendanceReports: L(attendance, 'AttendanceReports'),
  Students: L(people, 'Students'),
  StudentDetail: L(people, 'StudentDetail'),
  StudentForm: L(people, 'StudentForm'),
  Parents: L(people, 'Parents'),
  Admissions: L(people, 'Admissions'),
  Staff: L(people, 'Staff'),
  Academics: L(academics, 'Academics'),
  Timetable: L(academics, 'Timetable'),
  Calendar: L(academics, 'Calendar'),
  Exams: L(exams, 'Exams'),
  ExamDetail: L(exams, 'ExamDetail'),
  School: L(admin, 'School'),
  Members: L(admin, 'Members'),
  Subscription: L(admin, 'Subscription'),
  Audit: L(admin, 'Audit'),
  MyFees: L(family, 'MyFees'),
  MyAttendance: L(family, 'MyAttendance'),
  MyResults: L(family, 'MyResults'),
  MyTimetable: L(family, 'MyTimetable'),
  MyLeave: L(family, 'MyLeave'),
  Notifications: L(family, 'Notifications'),
  Library: L(services, 'Library'),
  Inventory: L(services, 'Inventory'),
  Hostels: L(services, 'Hostels'),
  HR: L(services, 'HR'),
  MyHR: L(services, 'MyHR'),
  MyLibrary: L(family, 'MyLibrary'),
  Announcements: L(communication, 'Announcements'),
  NoticeBoard: L(communication, 'NoticeBoard'),
  NotificationHistory: L(communication, 'NotificationHistory'),
  CommunicationSettings: L(communication, 'CommunicationSettings'),
  Reports: L(reports, 'Reports'),
  PlatformAnalytics: L(platform, 'PlatformAnalytics'),
  PlatformSchools: L(platform, 'PlatformSchools'),
  PlatformPlans: L(platform, 'PlatformPlans'),
};

function RequireAuth({ children }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.status === 'loading') return <LoadingState rows={6} />;
  if (auth.status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location }} />;
  if (!auth.tenant && !auth.isPlatformAdmin) return <Navigate to="/select-school" replace />;
  return children;
}

function Home() {
  const auth = useAuth();
  return <Navigate to={!auth.tenant && auth.isPlatformAdmin ? '/platform/schools' : '/dashboard'} replace />;
}

const NotFound = () => <EmptyState icon="signpost-split" title="Page not found" message="The page you are looking for does not exist." />;

export default function App() {
  return (
    <Suspense fallback={<LoadingState rows={6} />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/select-school" element={<SelectSchoolPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route
          element={
            <RequireAuth>
              <AppLayout />
            </RequireAuth>
          }
        >
          <Route index element={<Home />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="account" element={<AccountPage />} />

          <Route path="fees" element={<P.FeeDashboard />} />
          <Route path="fees/collect" element={<P.CollectFee />} />
          <Route path="fees/invoices" element={<P.Invoices />} />
          <Route path="fees/invoices/:id" element={<P.InvoiceDetail />} />
          <Route path="fees/payments" element={<P.Payments />} />
          <Route path="fees/payments/:id" element={<P.Receipt />} />
          <Route path="fees/defaulters" element={<P.Defaulters />} />
          <Route path="fees/reminders" element={<P.Reminders />} />
          <Route path="fees/setup" element={<P.FeeSetup />} />
          <Route path="fees/reports" element={<P.FeeReports />} />

          <Route path="attendance" element={<P.AttendanceToday />} />
          <Route path="attendance/mark" element={<P.MarkAttendance />} />
          <Route path="attendance/leave" element={<P.LeaveRequests />} />
          <Route path="attendance/reports" element={<P.AttendanceReports />} />

          <Route path="students" element={<P.Students />} />
          <Route path="students/new" element={<P.StudentForm />} />
          <Route path="students/:id" element={<P.StudentDetail />} />
          <Route path="parents" element={<P.Parents />} />
          <Route path="admissions" element={<P.Admissions />} />
          <Route path="staff" element={<P.Staff />} />

          <Route path="academics" element={<P.Academics />} />
          <Route path="timetable" element={<P.Timetable />} />
          <Route path="calendar" element={<P.Calendar />} />
          <Route path="exams" element={<P.Exams />} />
          <Route path="exams/:id" element={<P.ExamDetail />} />

          <Route path="library" element={<P.Library />} />
          <Route path="inventory" element={<P.Inventory />} />
          <Route path="hostel" element={<P.Hostels />} />
          <Route path="hr" element={<P.HR />} />
          <Route path="my-hr" element={<P.MyHR />} />
          <Route path="my/library" element={<P.MyLibrary />} />
          <Route path="communication" element={<P.Announcements />} />
          <Route path="communication/history" element={<P.NotificationHistory />} />
          <Route path="communication/settings" element={<P.CommunicationSettings />} />
          <Route path="notices" element={<P.NoticeBoard />} />
          <Route path="reports" element={<P.Reports />} />
          <Route path="school" element={<P.School />} />
          <Route path="members" element={<P.Members />} />
          <Route path="subscription" element={<P.Subscription />} />
          <Route path="audit" element={<P.Audit />} />

          <Route path="my/fees" element={<P.MyFees />} />
          <Route path="my/attendance" element={<P.MyAttendance />} />
          <Route path="my/results" element={<P.MyResults />} />
          <Route path="my/timetable" element={<P.MyTimetable />} />
          <Route path="my/leave" element={<P.MyLeave />} />
          <Route path="notifications" element={<P.Notifications />} />

          <Route path="platform/analytics" element={<P.PlatformAnalytics />} />
          <Route path="platform/schools" element={<P.PlatformSchools />} />
          <Route path="platform/plans" element={<P.PlatformPlans />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
