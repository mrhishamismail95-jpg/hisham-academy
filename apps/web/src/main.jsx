import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

const students = [
  { name: 'سارة أحمد', initials: 'سأ', level: 'المستوى الثالث', subject: 'الرياضيات', progress: 86, status: 'نشط', color: 'coral' },
  { name: 'عمر خالد', initials: 'عخ', level: 'المستوى الثاني', subject: 'اللغة الإنجليزية', progress: 72, status: 'نشط', color: 'blue' },
  { name: 'ليان محمد', initials: 'لم', level: 'المستوى الأول', subject: 'العلوم', progress: 94, status: 'نشط', color: 'violet' },
  { name: 'يوسف علي', initials: 'يع', level: 'المستوى الرابع', subject: 'الرياضيات', progress: 61, status: 'متابعة', color: 'mint' },
];
const sessions = [
  { time: '09:00', period: 'صباحاً', title: 'رياضيات — المستوى الثالث', teacher: 'أ. خالد الحربي', count: '8 / 10', type: 'جماعية', tone: 'violet' },
  { time: '11:30', period: 'صباحاً', title: 'لغة إنجليزية — محادثة', teacher: 'أ. نورة السالم', count: '6 / 8', type: 'جماعية', tone: 'blue' },
  { time: '04:00', period: 'مساءً', title: 'علوم — تجربة عملية', teacher: 'أ. أحمد العتيبي', count: '1 / 1', type: 'فردية', tone: 'orange' },
];
const nav = [
  ['overview', 'نظرة عامة', '⌂'], ['students', 'الطلاب', '♙'], ['teachers', 'المعلمون', '♧'], ['sessions', 'الحصص والحجوزات', '◫'], ['payments', 'المدفوعات', '◈'], ['attendance', 'الحضور', '✓'], ['settings', 'الإعدادات', '⚙']
];

function App() {
  const [page, setPage] = useState('overview');
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState('');
  const title = nav.find(([key]) => key === page)?.[1] || 'نظرة عامة';
  const filtered = useMemo(() => students.filter(s => `${s.name} ${s.subject}`.includes(query)), [query]);
  const toast = (message) => { setNotice(message); setTimeout(() => setNotice(''), 2600); };

  return <div className="shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">هـ</div><div><strong>هشام أكاديمي</strong><small>منصة التعليم الذكي</small></div></div>
      <div className="profile-card"><div className="avatar dark">هـ</div><div><b>هشام إسماعيل</b><small>مدير الأكاديمية</small></div><span className="online-dot" /></div>
      <nav><div className="nav-label">القائمة الرئيسية</div>{nav.map(([key, label, icon]) => <button key={key} className={page === key ? 'nav-item active' : 'nav-item'} onClick={() => setPage(key)}><span className="nav-icon">{icon}</span><span>{label}</span>{key === 'payments' && <em>3</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="help-box"><span>؟</span><div><b>هل تحتاج للمساعدة؟</b><small>تواصل مع الدعم الفني</small></div></div><button className="logout" onClick={() => toast('تم تسجيل الخروج من الوضع التجريبي')}>↪ <span>تسجيل الخروج</span></button></div>
    </aside>
    <main className="main">
      <header className="topbar"><div className="breadcrumb"><span>الرئيسية</span><b>/</b><strong>{title}</strong></div><div className="top-actions"><label className="search"><span>⌕</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث عن طالب، معلم..." /></label><button className="icon-button" onClick={() => toast('لا توجد إشعارات جديدة')} aria-label="الإشعارات">♢<i /></button><div className="mini-avatar">هـ</div></div></header>
      <div className="content">
        {page === 'overview' ? <Overview onNavigate={setPage} onToast={toast} /> : <Section page={page} students={filtered} onToast={toast} />}
      </div>
    </main>
    {notice && <div className="toast">✓ {notice}</div>}
  </div>;
}

function Overview({ onNavigate, onToast }) {
  return <>
    <section className="welcome"><div><span className="eyebrow">الأربعاء، ٢٥ نوفمبر ٢٠٢٦</span><h1>صباح الخير، هشام <span>✦</span></h1><p>إليك ملخص أداء الأكاديمية اليوم.</p></div><button className="primary" onClick={() => onToast('تم فتح نموذج إضافة طالب جديد')}>＋ إضافة طالب جديد</button></section>
    <section className="stats"><Stat label="إجمالي الطلاب" value="248" delta="12.5%" note="من الشهر الماضي" tone="teal" icon="♙" /><Stat label="إجمالي المعلمين" value="24" delta="8.3%" note="من الشهر الماضي" tone="violet" icon="♧" /><Stat label="الحصص هذا الشهر" value="1,284" delta="18.7%" note="من الشهر الماضي" tone="orange" icon="◫" /><Stat label="الإيرادات" value="42,850" unit="ر.س" delta="15.2%" note="من الشهر الماضي" tone="blue" icon="◈" /></section>
    <section className="grid-two"><div className="panel chart-panel"><div className="panel-head"><div><h2>نشاط الأكاديمية</h2><p>الحصص والحجوزات خلال الأسبوع</p></div><select><option>هذا الأسبوع</option><option>هذا الشهر</option></select></div><div className="chart"><div className="axis"><span>80</span><span>60</span><span>40</span><span>20</span><span>0</span></div><div className="bars">{[['السبت',38,55],['الأحد',52,68],['الإثنين',45,76],['الثلاثاء',63,48],['الأربعاء',70,84],['الخميس',48,61],['الجمعة',30,43]].map(([day,a,b]) => <div className="bar-group" key={day}><div className="bar-wrap"><i style={{height:`${a}%`}} /><i className="bar-alt" style={{height:`${b}%`}} /></div><small>{day}</small></div>)}</div></div><div className="legend"><span><i className="dot teal" />الحصص</span><span><i className="dot orange" />الحجوزات</span></div></div><div className="panel goal-panel"><div className="panel-head"><div><h2>تحقيق الهدف الشهري</h2><p>نوفمبر ٢٠٢٦</p></div><button className="more">•••</button></div><div className="goal"><div className="ring"><div><b>78%</b><small>مكتمل</small></div></div><div className="goal-text"><b>هدف الإيرادات</b><strong>42,850 <small>ر.س</small></strong><span>من أصل 55,000 ر.س</span></div></div><div className="goal-footer"><span>متبقي للوصول للهدف</span><b>12,150 ر.س</b></div></div></section>
    <section className="grid-two bottom-grid"><div className="panel"><div className="panel-head"><div><h2>الحصص القادمة</h2><p>اليوم، ٢٥ نوفمبر</p></div><button className="text-button" onClick={() => onNavigate('sessions')}>عرض الكل ←</button></div><div className="session-list">{sessions.map(s => <div className="session" key={s.time}><div className={`time ${s.tone}`}><b>{s.time}</b><small>{s.period}</small></div><div className="session-info"><b>{s.title}</b><span>{s.teacher} <i /> {s.type}</span></div><div className="session-count"><b>{s.count}</b><small>طلاب</small></div><button className="more">•••</button></div>)}</div></div><div className="panel"><div className="panel-head"><div><h2>أحدث الطلاب</h2><p>الطلاب المضافون مؤخراً</p></div><button className="text-button" onClick={() => onNavigate('students')}>عرض الكل ←</button></div><div className="student-list">{students.slice(0,3).map(s => <div className="student-row" key={s.name}><div className={`avatar ${s.color}`}>{s.initials}</div><div><b>{s.name}</b><span>{s.subject}</span></div><div className="progress"><div><i style={{width:`${s.progress}%`}} /></div><small>{s.progress}%</small></div></div>)}</div></div></section>
  </>;
}
function Stat({ label, value, unit, delta, note, tone, icon }) { return <div className="stat"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-copy"><span>{label}</span><strong>{value} <small>{unit}</small></strong><p><b>↑ {delta}</b> {note}</p></div></div>; }
function Section({ page, students, onToast }) {
  const labels = { students:['الطلاب','إدارة ملفات الطلاب ومتابعة تقدمهم'], teachers:['المعلمون','فريق التدريس والجداول المتاحة'], sessions:['الحصص والحجوزات','إدارة الحصص ومقاعد الطلاب'], payments:['المدفوعات','متابعة التحصيل والمعاملات المالية'], attendance:['الحضور','سجل حضور الطلاب اليومي'], settings:['الإعدادات','إدارة إعدادات الأكاديمية والحساب'] };
  const [heading, subtitle] = labels[page] || labels.students;
  return <><section className="welcome compact"><div><span className="eyebrow">لوحة التحكم / {heading}</span><h1>{heading}</h1><p>{subtitle}</p></div><button className="primary" onClick={() => onToast(`تم فتح نموذج إضافة ${heading}`)}>＋ إضافة جديد</button></section><div className="panel full-panel">{page === 'students' ? <><div className="panel-head"><div><h2>قائمة الطلاب <span className="count-badge">248</span></h2><p>بيانات الطلاب المسجلين في الأكاديمية</p></div><button className="secondary" onClick={() => onToast('تم تجهيز ملف التصدير')}>↓ تصدير البيانات</button></div><div className="table"><div className="tr th"><span>الطالب</span><span>المادة</span><span>المستوى</span><span>التقدم</span><span>الحالة</span><span /></div>{students.map(s => <div className="tr" key={s.name}><span className="person"><div className={`avatar ${s.color}`}>{s.initials}</div><b>{s.name}</b></span><span>{s.subject}</span><span>{s.level}</span><span className="table-progress"><i style={{width:`${s.progress}%`}} /> {s.progress}%</span><span><em className="status active-status">{s.status}</em></span><button className="more">•••</button></div>)}</div></> : <div className="empty-state"><div className="empty-icon">{page === 'payments' ? '◈' : page === 'attendance' ? '✓' : '◫'}</div><h2>{heading}</h2><p>هذه الشاشة جاهزة للربط بقاعدة البيانات. يمكنك البدء بإضافة السجلات من الزر أعلاه.</p><button className="primary" onClick={() => onToast('تم إنشاء سجل تجريبي بنجاح')}>＋ إنشاء سجل تجريبي</button></div>}</div></>;
}

createRoot(document.getElementById('root')).render(<App />);
