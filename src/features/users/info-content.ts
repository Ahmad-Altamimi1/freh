import type { InfobarContent } from '@/components/ui/infobar';

export const usersInfoContent: InfobarContent = {
  title: 'المستخدمون — دليل حسابات Supabase Auth',
  sections: [
    {
      title: 'مصدر البيانات',
      description:
        'هذا الجدول هو دليل مستخدمي Supabase Auth نفسه (auth.users)، لا نسخة مرآة في جدول تطبيقي — فلا مجال لاختلافه عمّن يستطيع تسجيل الدخول فعليًا. القراءة والكتابة تمرّان عبر Auth Admin API بمفتاح service role، ولذلك يعيد كل إجراء في طبقة الخدمة التحقق من صلاحية access:manage قبل أن يمسّ أي شيء — فوجود ‎use server‎ يجعل كل دالة مُصدَّرة نقطة نهاية POST قائمة بذاتها.',
      links: [
        {
          title: 'Supabase Auth Admin API',
          url: 'https://supabase.com/docs/reference/javascript/auth-admin-listusers'
        }
      ]
    },
    {
      title: 'الحقول وأين تُخزَّن',
      description:
        'الاسم ورقم الهاتف يأتيان من user_metadata، وهي بيانات يستطيع المستخدم تعديلها بنفسه — للعرض فقط. أما الصلاحيات فتأتي من جدولَي user_roles و roles في قاعدة البيانات لا من app_metadata: الصلاحية المخزَّنة في التوكن لا يسري سحبها إلا بعد تحديثه، بينما ما يُقرأ من الجداول يسري من الطلب التالي مباشرة. والحالة محسوبة لا مخزَّنة: «موقوف» تعني حسابًا محظورًا، و«بانتظار التفعيل» تعني حسابًا لم يُؤكَّد بريده ولم يسجّل الدخول بعد.',
      links: [
        {
          title: 'إدارة بيانات المستخدم في Supabase',
          url: 'https://supabase.com/docs/guides/auth/managing-user-data'
        }
      ]
    },
    {
      title: 'الجلب المسبق على الخادم ثم الترطيب على العميل',
      description:
        'مكوّن الخادم يقرأ معاملات البحث عبر searchParamsCache ويبني المرشِّحات ثم يستدعي queryClient.prefetchQuery()، وتُمرَّر الحالة المُجفَّفة إلى HydrationBoundary ليبدأ العميل ببيانات جاهزة في الذاكرة المؤقتة. ومكوّن العميل يقرأ المعاملات ذاتها عبر useQueryStates ويستدعي useSuspenseQuery بالمرشِّحات نفسها.',
      links: [
        {
          title: 'توثيق TanStack Query — SSR',
          url: 'https://tanstack.com/query/latest/docs/framework/react/guides/advanced-ssr'
        }
      ]
    },
    {
      title: 'البحث والتصفية والترتيب تجري في الذاكرة',
      description:
        'واجهة Auth Admin تدعم التقسيم إلى صفحات فقط، دون بحث أو تصفية أو ترتيب. لذلك تجلب طبقة الخدمة الدليل كاملًا (بحدٍّ أقصى عشر صفحات × ١٠٠٠ حساب) ثم تُضيّقه في Node. هذا كافٍ على نطاق لوحة تحكم؛ وإذا تجاوز عدد الحسابات عشرة آلاف فالأنسب إنشاء view فوق auth.users ودفع الشرط إلى Postgres.',
      links: [
        {
          title: 'توثيق nuqs',
          url: 'https://nuqs.47ng.com'
        }
      ]
    }
  ]
};
