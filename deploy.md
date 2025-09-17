# GitHub Pages Deployment Guide

## خطوات النشر على GitHub Pages

### 1. إعداد المستودع

```bash
# إنشاء مستودع جديد على GitHub
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/[username]/Almohtrefon0.1.git
git push -u origin main
```

### 2. تفعيل GitHub Pages

1. اذهب إلى Settings في المستودع
2. انتقل إلى Pages في القائمة الجانبية
3. اختر Source: Deploy from a branch
4. اختر Branch: gh-pages
5. اضغط Save

### 3. النشر

```bash
npm run deploy
```

### 4. الوصول للموقع

الموقع سيكون متاحاً على:
`https://[username].github.io/Almohtrefon0.1/`

## ملاحظات مهمة

- تأكد من أن اسم المستودع هو `Almohtrefon0.1`
- إذا كان الاسم مختلف، غيّر `basename` في `App.tsx` و `base` في `vite.config.ts`
- MSW يعمل فقط في وضع التطوير، لن يعمل في الإنتاج
