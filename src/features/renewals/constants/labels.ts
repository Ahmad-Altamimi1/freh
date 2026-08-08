import { formatNumberAr } from '@/lib/format';
import type { RenewalStage } from '@/db/schema/board-renewals';

/**
 * Arabic vocabulary for the board-renewal tracker.
 *
 * Same reasoning as the organizations feature's `labels.ts`: a plain const map
 * rather than an i18n layer, and the single place a stage's wording lives so the
 * column heading, the move menu and the card badge cannot drift apart.
 */

/** Column headings — what the stage *is*. */
export const RENEWAL_STAGE_LABELS: Record<RenewalStage, string> = {
  due: 'مستحقة',
  notified: 'أُشعِرت الجمعية',
  scheduled: 'موعد الانتخاب محدّد',
  delegateAssigned: 'مندوب معيّن',
  elected: 'تم الانتخاب',
  minutesReceived: 'المحضر مستلم',
  boardUpdated: 'المجلس محدّث'
};

/**
 * What moving *into* a stage means — the wording on the action, not the column.
 *
 * Separate from the headings above because a column names a state while a button
 * names an act: "أُشعِرت الجمعية" is where the card sits, "تسجيل الإشعار" is what
 * the user is about to do.
 */
export const RENEWAL_STAGE_ACTIONS: Record<RenewalStage, string> = {
  due: 'إعادة إلى المستحقة',
  notified: 'تسجيل الإشعار',
  scheduled: 'تحديد موعد الانتخاب',
  delegateAssigned: 'تعيين مندوب',
  elected: 'تسجيل إجراء الانتخاب',
  minutesReceived: 'تسجيل استلام المحضر',
  boardUpdated: 'إغلاق: المجلس محدّث'
};

/** One line explaining what the directorate does at each stage. */
export const RENEWAL_STAGE_HINTS: Record<RenewalStage, string> = {
  due: 'انتهت دورتها أو أوشكت، ولم يبدأ إجراء التجديد بعد.',
  notified: 'أُرسل كتاب رسمي للجمعية بوجوب إجراء الانتخاب.',
  scheduled: 'اعتُمد موعد الانتخاب وسُجّل في النظام.',
  delegateAssigned: 'كُلّف مندوب من المديرية بحضور الانتخاب.',
  elected: 'جرى الانتخاب، وبانتظار وصول المحضر.',
  minutesReceived: 'وصل محضر الانتخاب ويُدقَّق قبل اعتماد المجلس.',
  boardUpdated: 'أُدخل المجلس الجديد على السجل واكتمل الإجراء.'
};

export const RENEWAL_LABELS = {
  page: {
    title: 'تجديد الهيئات الإدارية',
    description:
      'متابعة الجمعيات المستحقة للانتخاب مرحلة بمرحلة، من إشعار الجمعية حتى اعتماد المجلس الجديد.',
    empty: 'لا توجد جمعية مستحقة للتجديد حاليًا.',
    emptyHint: 'تظهر الجمعية هنا تلقائيًا عند اقتراب انتهاء دورتها.',
    noAccess: {
      title: 'لا توجد بيانات لعرضها',
      description:
        'حسابك لا يملك صلاحية الاطلاع على لوحة التجديد. راجع مدير النظام إذا كنت بحاجة إلى ذلك.'
    }
  },
  summary: {
    open: 'قيد المتابعة',
    overdue: 'متأخرة',
    completed: 'مكتملة',
    /** The notice window the first column is populated from. */
    window: (days: number) => `تدخل اللوحة قبل ${formatNumberAr(days)} يومًا من انتهاء الدورة.`
  },
  card: {
    termEnd: 'نهاية الدورة',
    electionDate: 'موعد الانتخاب',
    delegate: 'المندوب',
    members: 'الأعضاء',
    notes: 'ملاحظات',
    /** Lateness, which is the number the whole board exists to surface. */
    overdue: (days: number) => `متأخرة ${formatNumberAr(days)} يومًا`,
    dueIn: (days: number) => `تنتهي بعد ${formatNumberAr(days)} يومًا`,
    dueToday: 'تنتهي اليوم',
    notStarted: 'لم يبدأ الإجراء',
    openOrganization: 'فتح صفحة الجمعية',
    updateMembers: 'تحديث أعضاء المجلس',
    edit: 'تعديل التفاصيل',
    moveTo: 'نقل إلى مرحلة…',
    next: 'المرحلة التالية',
    history: 'سجل المراحل',
    noHistory: 'لم تُسجَّل أي حركة بعد.'
  },
  details: {
    title: 'تفاصيل التجديد',
    description: 'موعد الانتخاب والمندوب المكلّف وأي ملاحظات على الإجراء.',
    electionDate: 'موعد الانتخاب',
    delegateName: 'اسم المندوب',
    notes: 'ملاحظات',
    notesPlaceholder: 'أي تفصيل يخص هذا التجديد…',
    save: 'حفظ',
    cancel: 'إلغاء'
  },
  toast: {
    moved: (stage: string) => `تم النقل إلى «${stage}».`,
    moveFailed: 'تعذّر نقل الجمعية إلى المرحلة المطلوبة.',
    saved: 'تم حفظ التفاصيل.',
    saveFailed: 'تعذّر حفظ التفاصيل.',
    /** Shown on closing a renewal, because the roster is the point of the whole cycle. */
    closedHint: 'تأكّد من إدخال أعضاء المجلس الجديد على صفحة الجمعية.'
  }
} as const;
