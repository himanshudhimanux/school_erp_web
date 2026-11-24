/**
 * Sidebar navigation. `show(auth)` decides visibility from effective permissions (the API still
 * enforces every action). No Transport/GPS entries in this release (DESIGN.md).
 */
const staff = (fn) => (a) => a.isStaff && fn(a);

export const STAFF_NAV = [
  { group: 'Overview', items: [{ to: '/dashboard', label: 'Dashboard', icon: 'grid-1x2', show: () => true }] },
  {
    group: 'Fee Management',
    items: [
      { to: '/fees', label: 'Fee Dashboard', icon: 'cash-stack', end: true, show: staff((a) => a.can('fees.read')) },
      { to: '/fees/collect', label: 'Collect Fee', icon: 'wallet2', show: staff((a) => a.can('fees.collect')) },
      { to: '/fees/invoices', label: 'Invoices', icon: 'receipt', show: staff((a) => a.can('fees.read')) },
      { to: '/fees/payments', label: 'Payments', icon: 'credit-card', show: staff((a) => a.can('fees.read')) },
      { to: '/fees/defaulters', label: 'Defaulters', icon: 'exclamation-diamond', show: staff((a) => a.can('fees.reports')) },
      { to: '/fees/reminders', label: 'Automated Reminders', icon: 'bell', show: staff((a) => a.can('fees.read')) },
      { to: '/fees/setup', label: 'Fee Setup', icon: 'sliders', show: staff((a) => a.can('fees.read')) },
      { to: '/fees/reports', label: 'Fee Reports', icon: 'graph-up', show: staff((a) => a.can('fees.reports')) },
    ],
  },
  {
    group: 'Attendance',
    items: [
      { to: '/attendance', label: 'Today’s Attendance', icon: 'calendar-check', end: true, show: staff((a) => a.canAny('attendance.mark', 'attendance.update', 'attendance.reports')) },
      { to: '/attendance/mark', label: 'Mark Attendance', icon: 'check2-square', show: staff((a) => a.canAny('attendance.mark', 'attendance.update')) },
      { to: '/attendance/leave', label: 'Leave Requests', icon: 'envelope-paper', show: staff((a) => a.canAny('attendance.mark', 'attendance.update')) },
      { to: '/attendance/reports', label: 'Attendance Reports', icon: 'clipboard-data', show: staff((a) => a.canAny('attendance.mark', 'attendance.reports')) },
    ],
  },
  {
    group: 'People',
    items: [
      { to: '/students', label: 'Students', icon: 'mortarboard', show: staff((a) => a.can('students.read')) },
      { to: '/admissions', label: 'Admissions', icon: 'person-plus', show: staff((a) => a.can('admissions.read')) },
      { to: '/parents', label: 'Parents', icon: 'people', show: staff((a) => a.can('parents.read')) },
      { to: '/staff', label: 'Teachers & Staff', icon: 'person-badge', show: staff((a) => a.can('staff.read')) },
    ],
  },
  {
    group: 'Academics',
    items: [
      { to: '/exams', label: 'Examinations', icon: 'journal-check', show: staff((a) => a.can('exams.read')) },
      { to: '/timetable', label: 'Timetable', icon: 'clock', show: staff((a) => a.can('timetable.read')) },
      { to: '/academics', label: 'Classes & Sections', icon: 'diagram-3', show: staff((a) => a.can('academics.read')) },
      { to: '/calendar', label: 'Academic Calendar', icon: 'calendar-event', show: (a) => a.can('calendar.read') },
    ],
  },
  {
    group: 'Campus Services',
    items: [
      { to: '/library', label: 'Library', icon: 'book', show: staff((a) => a.can('library.read')) },
      { to: '/hostel', label: 'Hostel', icon: 'house-door', show: staff((a) => a.can('hostel.read')) },
      { to: '/inventory', label: 'Inventory', icon: 'box-seam', show: staff((a) => a.can('inventory.read')) },
      { to: '/hr', label: 'HR & Payroll', icon: 'person-vcard', show: staff((a) => a.canAny('hr.read', 'hr.payroll')) },
      { to: '/my-hr', label: 'My Leave & Payslips', icon: 'calendar-heart', show: staff((a) => a.can('hr.self')) },
    ],
  },
  {
    group: 'Communication',
    items: [
      { to: '/communication', label: 'Announcements', icon: 'megaphone', end: true, show: staff((a) => a.can('communication.read')) },
      { to: '/notices', label: 'Notice Board', icon: 'pin-angle', show: staff((a) => a.can('communication.read')) },
      { to: '/notifications', label: 'My Notifications', icon: 'bell', show: staff(() => true) },
      { to: '/communication/history', label: 'Notification History', icon: 'clock-history', show: staff((a) => a.can('communication.send')) },
      { to: '/communication/settings', label: 'Channels & Templates', icon: 'sliders2', show: staff((a) => a.can('communication.read')) },
    ],
  },
  {
    group: 'Insights',
    items: [{ to: '/reports', label: 'Reports', icon: 'bar-chart-line', show: staff((a) => a.can('reports.read')) }],
  },
  {
    group: 'Administration',
    items: [
      { to: '/school', label: 'Institution', icon: 'building', show: staff((a) => a.can('school.read')) },
      { to: '/members', label: 'Users & Roles', icon: 'shield-lock', show: staff((a) => a.can('users.read')) },
      { to: '/subscription', label: 'Subscription', icon: 'stars', show: staff((a) => a.can('subscription.read')) },
      { to: '/audit', label: 'Audit Logs', icon: 'clock-history', show: staff((a) => a.can('audit.read')) },
    ],
  },
];

export const FAMILY_NAV = [
  {
    group: 'My School',
    items: [
      { to: '/dashboard', label: 'Dashboard', icon: 'grid-1x2', show: () => true },
      { to: '/my/fees', label: 'Fees', icon: 'cash-stack', show: (a) => a.isParent && a.can('fees.read') },
      { to: '/my/attendance', label: 'Attendance', icon: 'calendar-check', show: (a) => a.can('attendance.read') },
      { to: '/my/results', label: 'Results', icon: 'journal-check', show: (a) => a.can('exams.read') },
      { to: '/my/timetable', label: 'Timetable', icon: 'clock', show: (a) => a.can('timetable.read') },
      { to: '/my/leave', label: 'Leave Requests', icon: 'envelope-paper', show: (a) => a.can('attendance.read') },
      { to: '/my/library', label: 'Library & Hostel', icon: 'book', show: (a) => a.canAny('library.read', 'hostel.read') },
      { to: '/calendar', label: 'Calendar', icon: 'calendar-event', show: (a) => a.can('calendar.read') },
      { to: '/notices', label: 'Notice Board', icon: 'pin-angle', show: (a) => a.can('communication.read') },
      { to: '/notifications', label: 'Notifications', icon: 'bell', show: () => true },
    ],
  },
];

export const PLATFORM_NAV = [
  {
    group: 'Platform',
    items: [
      { to: '/platform/analytics', label: 'Analytics', icon: 'bar-chart-line', show: () => true },
      { to: '/platform/schools', label: 'Schools', icon: 'buildings', show: () => true },
      { to: '/platform/plans', label: 'Plans', icon: 'stars', show: () => true },
    ],
  },
];

export function navFor(auth) {
  const source = auth.tenant ? (auth.isStaff ? STAFF_NAV : FAMILY_NAV) : auth.isPlatformAdmin ? PLATFORM_NAV : [];
  return source.map((g) => ({ ...g, items: g.items.filter((i) => i.show(auth)) })).filter((g) => g.items.length);
}
