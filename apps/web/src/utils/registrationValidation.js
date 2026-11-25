export function validateRegistration(input) {
  const requestType = ['student', 'parent', 'teacher'].includes(input.requestType) ? input.requestType : null;
  if (!requestType) return 'نوع التسجيل غير صحيح';
  if (!String(input.fullName || '').trim()) return 'الاسم الكامل مطلوب';
  if (!/^\+?[0-9\s()-]{8,20}$/.test(String(input.phone || '').trim())) return 'رقم الهاتف غير صحيح';
  if (requestType !== 'teacher' && !String(input.grade || '').trim()) return 'المرحلة الدراسية مطلوبة';
  if (requestType === 'teacher' && !String(input.subject || '').trim()) return 'المادة مطلوبة للمعلم';
  return null;
}
export function makeRegistrationCode(sequence) {
  return `HA-${String(sequence).padStart(6, '0')}`;
}
