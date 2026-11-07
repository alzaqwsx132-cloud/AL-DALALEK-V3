إصلاح خطأ بناء EXE في نسخة الدلالك v3
=================================
الخطأ: TS2550: Property 'replaceAll' does not exist on type 'string'.
السبب: tsconfig.app.json يحدّد مكتبات ES2020، لكن replaceAll تتطلب ES2021.
الإصلاح: تم تعديل lib إلى ES2021 مع إبقاء باقي المشروع كما هو.

طريقة الاستخدام:
1) فك الضغط بالكامل في مجلد جديد على سطح المكتب.
2) افتح Al_Dalalek_v3_Windows_Builder.
3) شغّل BUILD_EXE.cmd بالنقر المزدوج، والإنترنت متصل.
4) عند النجاح تجد الملف:
   project\windows-release\Al-Dalalek-v3.exe

مهم: هذه حزمة المصدر وأداة البناء، وليست ملف EXE الجاهز.
يجب نجاح التحقق وبناء Electron على ويندوز حتى ينتج EXE.
