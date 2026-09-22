# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ui/education.spec.ts >> prepayment-penalty note and article - hebrew @ 1280px
- Location: e2e/tests/ui/education.spec.ts:23:5

# Error details

```
Error: tax caret ~ ⚠️ width

expect(received).toBeGreaterThan(expected)

Expected: > 10.2
Received:   10
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic "מדדי מחירים" [ref=e3]:
    - link "מדד המחירים לצרכן 105.8 hiddentext שינוי חודשי ⭡ 0.7%+ שינוי שנתי 1.5%" [ref=e4] [cursor=pointer]:
      - /url: https://google.com/search?q=מדד+המחירים+לצרכן
      - text: מדד המחירים לצרכן 105.8
      - generic: hiddentext
      - generic [ref=e5]: שינוי חודשי
      - text: ⭡ 0.7%+
      - generic [ref=e6]: שינוי שנתי
      - text: 1.5%
    - link "מדד תשומה בבנייה למגורים 103.9 hiddentext שינוי חודשי ⭡ 0.4%+ שינוי שנתי 3.5%" [ref=e7] [cursor=pointer]:
      - /url: https://google.com/search?q=מדד+תשומה+בבנייה+למגורים
      - text: מדד תשומה בבנייה למגורים 103.9
      - generic: hiddentext
      - generic [ref=e8]: שינוי חודשי
      - text: ⭡ 0.4%+
      - generic [ref=e9]: שינוי שנתי
      - text: 3.5%
    - link "מדד תשומה בבנייה למבני מסחר ומשרדים 136 hiddentext שינוי חודשי ⭡ 0.2%+ שינוי שנתי ⭣ 2.8%" [ref=e10] [cursor=pointer]:
      - /url: https://google.com/search?q=מדד+תשומה+בבנייה+למבני+מסחר+ומשרדים
      - text: מדד תשומה בבנייה למבני מסחר ומשרדים 136
      - generic: hiddentext
      - generic [ref=e11]: שינוי חודשי
      - text: ⭡ 0.2%+
      - generic [ref=e12]: שינוי שנתי
      - text: ⭣ 2.8%
  - generic "מחירי שוק" [ref=e13]
  - navigation [ref=e14]:
    - checkbox
    - link "ראשי" [ref=e16] [cursor=pointer]:
      - /url: /
    - list [ref=e18]:
      - listitem [ref=e19]:
        - link "ראשי" [ref=e20] [cursor=pointer]:
          - /url: /
      - listitem [ref=e21]:
        - link "השירות שלנו" [ref=e22] [cursor=pointer]:
          - /url: /services
      - listitem [ref=e23]:
        - link "מחשבון משכנתא" [ref=e24] [cursor=pointer]:
          - /url: javascript:void(0);
      - listitem [ref=e25]:
        - link "מאמרים" [ref=e26] [cursor=pointer]:
          - /url: /articles
      - listitem [ref=e27]:
        - link "צרו קשר" [ref=e28] [cursor=pointer]:
          - /url: /contact
      - generic [ref=e29]:
        - listitem [ref=e30]:
          - link [ref=e31] [cursor=pointer]:
            - /url: tel:0527729974
        - listitem [ref=e34]:
          - link [ref=e35] [cursor=pointer]:
            - /url: https://wa.me/972527729974?text=What's%20up%3F
        - listitem [ref=e38]:
          - link [ref=e39] [cursor=pointer]:
            - /url: https://ul.waze.com/ul?place=ChIJp9fIOZ9MHRURg5L4vD_YK1c&ll=32.05632250%2C34.76931260&navigate=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location
        - listitem [ref=e42]:
          - link [ref=e43] [cursor=pointer]:
            - /url: mailto:anatoly.makeyev@gmail.com?subject=I%20need%20financial%20advice!
        - listitem [ref=e46]:
          - link [ref=e47] [cursor=pointer]:
            - /url: https://www.facebook.com/makeyev.finance
        - listitem [ref=e50]:
          - link "Switch to English" [ref=e51] [cursor=pointer]:
            - /url: javascript:void(0);
        - listitem [ref=e53]:
          - link "מצב כהה" [ref=e54] [cursor=pointer]:
            - /url: javascript:void(0);
  - main [ref=e58]:
    - generic [ref=e59]:
      - heading "מחשבון משכנתא" [level=1] [ref=e61]
      - button "גלישה אל התוכן שמתחת לבאנר" [ref=e62] [cursor=pointer]
    - main [ref=e65]:
      - region "מחשבון משכנתא" [ref=e66]:
        - generic [ref=e67]:
          - heading "תכנון ההחזר החודשי והסכום הכולל" [level=2] [ref=e69]
          - generic [ref=e70]:
            - button "השוואת תמהילים" [ref=e71] [cursor=pointer]
            - button "איפוס נתונים" [ref=e72] [cursor=pointer]
        - generic [ref=e73]:
          - generic [ref=e74]:
            - generic [ref=e75]:
              - text: סכום המשכנתא
              - generic [ref=e76]:
                - textbox "סכום המשכנתא" [disabled] [ref=e77]: 1,500,000
                - generic [ref=e78]: ₪
            - generic [ref=e79]:
              - generic [ref=e80]:
                - generic [ref=e81]: משכנתא לתקופה בשנים
                - button "מידע נוסף על תקופת המשכנתא" [ref=e83] [cursor=pointer]:
                  - generic [ref=e84]: "?"
              - generic [ref=e85]:
                - generic [ref=e86]: "1"
                - generic [ref=e87]:
                  - slider "משכנתא לתקופה בשנים" [ref=e88] [cursor=pointer]: "15"
                  - status: "15"
                - generic [ref=e89]: "30"
            - button "הצג ההחזרים" [ref=e90] [cursor=pointer]
          - generic [ref=e92]:
            - generic [ref=e93]:
              - text: תכלית הרכישה
              - combobox "תכלית הרכישה" [ref=e95] [cursor=pointer]:
                - option "דירה ראשונה (75% מימון)" [selected]
                - option "שדרוג דירה (70% מימון)"
                - option "דירה להשקעה (50% מימון)"
            - generic [ref=e96]:
              - text: שווי הנכס
              - generic [ref=e97]:
                - textbox "שווי הנכס" [ref=e98]: 2,000,000
                - generic [ref=e99]: ₪
            - generic [ref=e100]:
              - text: הון עצמי
              - generic [ref=e101]:
                - textbox "הון עצמי" [ref=e102]:
                  - /placeholder: 500,000
                  - text: 500,000
                - generic [ref=e103]: ₪
            - generic [ref=e104]:
              - text: הכנסה נטו לחודש
              - generic [ref=e105]:
                - textbox "הכנסה נטו לחודש" [ref=e106]:
                  - /placeholder: 35,500
                - generic [ref=e107]: ₪
          - generic [ref=e108]:
            - generic [ref=e109]:
              - text: דמי תיווך
              - generic [ref=e110]:
                - generic [ref=e111]:
                  - spinbutton "דמי תיווך" [ref=e112]
                  - generic [ref=e113]: "%"
                - generic [ref=e114]:
                  - textbox "דמי תיווך - סכום כולל מע\"מ" [ref=e115]:
                    - /placeholder: 47,200
                  - generic [ref=e116]: ₪
            - generic [ref=e117]:
              - text: שכר עו"ד
              - generic [ref=e118]:
                - generic [ref=e119]:
                  - spinbutton "שכר עו\"ד" [ref=e120]
                  - generic [ref=e121]: "%"
                - generic [ref=e122]:
                  - textbox "שכר עו\"ד - סכום כולל מע\"מ" [ref=e123]:
                    - /placeholder: 11,800
                  - generic [ref=e124]: ₪
            - generic [ref=e125]:
              - text: שמאי
              - generic [ref=e126]:
                - textbox "שמאי" [ref=e127]
                - generic [ref=e128]: ₪
            - generic [ref=e129]:
              - text: שיפוצים
              - generic [ref=e130]:
                - textbox "שיפוצים" [ref=e131]
                - generic [ref=e132]: ₪
            - generic [ref=e133]: הסכומים כוללים מע"מ
          - generic [ref=e134]:
            - generic [ref=e135]:
              - button "הסר הוצאה" [ref=e136] [cursor=pointer]: ×
              - generic [ref=e137]:
                - text: תיאור ההוצאה
                - textbox "תיאור ההוצאה ברשימת ההוצאות הנוספות" [ref=e139]
              - generic [ref=e140]:
                - text: תשלום חודשי
                - generic [ref=e141]:
                  - textbox "תשלום חודשי" [ref=e142]
                  - generic [ref=e143]: ₪
              - generic [ref=e144]:
                - text: תשלום חד פעמי
                - generic [ref=e145]:
                  - textbox "תשלום חד פעמי" [ref=e146]
                  - generic [ref=e147]: ₪
            - button "הוצאות נוספות +" [ref=e149] [cursor=pointer]
          - alert [ref=e150]:
            - generic [ref=e151]:
              - generic [ref=e152]: ✔️
              - text: הון עצמי
              - strong [ref=e153]: 25%
              - text: משווי הנכס ~ עומד במותר לדירה ראשונה (עד
              - strong [ref=e154]: 75%
              - text: )
            - generic [ref=e155]:
              - generic [ref=e156]: 💡
              - text: "מס רכישה (דירה ראשונה):"
              - strong [ref=e157]: ‏744 ‏₪
              - text: (
              - strong [ref=e158]: 0.04%
              - text: )
            - generic [ref=e159]:
              - generic [ref=e160]: 💡
              - text: ההחזר החודשי לתקופה של
              - strong [ref=e161]: "15"
              - text: שנים יהיה
              - strong [ref=e162]: ‏11,577 ‏₪
            - generic [ref=e163]:
              - generic [ref=e164]: 💡
              - text: "עלויות עסקה צפויות: תיווך"
              - strong [ref=e165]: ‏47,200 ‏₪
              - text: · עו"ד
              - strong [ref=e166]: ‏11,800 ‏₪
            - generic [ref=e167]:
              - generic [ref=e168]: 💡
              - text: "סה\"כ הון עצמי מומלץ לביצוע העסקה:"
              - strong [ref=e169]: ‏559,744 ‏₪
          - group [ref=e170]:
            - generic "פירוט מס רכישה" [active] [ref=e171] [cursor=pointer]
            - table [ref=e173]:
              - rowgroup [ref=e174]:
                - row [ref=e175]:
                  - columnheader "מדרגה" [ref=e176]
                  - columnheader "טווח" [ref=e177]
                  - columnheader "סכום חייב" [ref=e178]
                  - columnheader "מס לתשלום" [ref=e179]
              - rowgroup [ref=e180]:
                - row [ref=e181]:
                  - cell "0%" [ref=e182]
                  - cell [ref=e183]:
                    - text: עד
                    - strong [ref=e184]: ‏1,978,745 ‏₪
                  - cell "‏1,978,745 ‏₪" [ref=e185]
                  - cell "‏0 ‏₪" [ref=e186]
                - row [ref=e187]:
                  - cell "3.5% מדרגה נוכחית" [ref=e188]:
                    - text: 3.5%
                    - generic [ref=e189]: מדרגה נוכחית
                  - cell [ref=e190]:
                    - strong [ref=e191]: ‏1,978,745 ‏₪
                    - text: ~
                    - strong [ref=e192]: ‏2,347,040 ‏₪
                  - cell "‏21,255 ‏₪" [ref=e193]
                  - cell "‏744 ‏₪" [ref=e194]
                - row [ref=e195]:
                  - cell "5%" [ref=e196]
                  - cell [ref=e197]:
                    - strong [ref=e198]: ‏2,347,040 ‏₪
                    - text: ~
                    - strong [ref=e199]: ‏6,055,070 ‏₪
                  - cell "-" [ref=e200]
                  - cell "-" [ref=e201]
                - row [ref=e202]:
                  - cell "8%" [ref=e203]
                  - cell [ref=e204]:
                    - strong [ref=e205]: ‏6,055,070 ‏₪
                    - text: ~
                    - strong [ref=e206]: ‏20,183,565 ‏₪
                  - cell "-" [ref=e207]
                  - cell "-" [ref=e208]
                - row [ref=e209]:
                  - cell "10%" [ref=e210]
                  - cell [ref=e211]:
                    - strong [ref=e212]: ‏20,183,565 ‏₪
                    - text: ומעלה
                  - cell "-" [ref=e213]
                  - cell "-" [ref=e214]
              - rowgroup [ref=e215]:
                - row [ref=e216]:
                  - rowheader "סה\"כ מס לתשלום" [ref=e217]
                  - cell "‏744 ‏₪" [ref=e218]
          - generic [ref=e220]:
            - generic [ref=e221]: בחירת תמהיל
            - button "מידע נוסף על התמהילים המוכנים" [ref=e223] [cursor=pointer]:
              - generic [ref=e224]: "?"
          - group "בחירת תמהיל" [ref=e225]:
            - button "תמהיל 1" [ref=e226] [cursor=pointer]
            - button "תמהיל 2" [ref=e227] [cursor=pointer]
            - button "תמהיל 3" [ref=e228] [cursor=pointer]
            - button "תמהיל מומלץ" [pressed] [ref=e229] [cursor=pointer]
          - generic [ref=e230]:
            - group "מסלול 1" [ref=e231]:
              - button "הסר מסלול" [ref=e233] [cursor=pointer]: ×
              - generic [ref=e234]:
                - generic [ref=e235]:
                  - generic [ref=e236]: סוג מסלול
                  - button "מידע נוסף על סוגי המסלולים" [ref=e238] [cursor=pointer]:
                    - generic [ref=e239]: "?"
                - combobox "סוג מסלול מידע נוסף על סוגי המסלולים" [ref=e241] [cursor=pointer]:
                  - option "פריים" [selected]
                  - option "קבועה לא צמודה"
                  - option "משתנה כל 5 שנים לא צמודה"
                  - option "משתנה כל שנה לא צמודה"
                  - option "קבועה צמודה למדד"
                  - option "משתנה צמודה כל 5 שנים"
                  - option "משתנה צמודה כל שנה"
              - generic [ref=e242]:
                - text: סכום
                - generic [ref=e243]:
                  - textbox "סכום" [ref=e244]: 600,000
                  - generic [ref=e245]: ₪
              - generic [ref=e246]:
                - text: תקופה
                - generic [ref=e247]:
                  - spinbutton "תקופה 1" [ref=e248]: "15"
                  - generic [ref=e249]: שנים
              - generic [ref=e250]:
                - text: ריבית
                - generic [ref=e251]:
                  - spinbutton "ריבית 1" [ref=e252]: "5.75"
                  - generic [ref=e253]: "%"
              - generic [ref=e254]:
                - generic [ref=e255]:
                  - generic [ref=e256]: לוח סילוקין
                  - button "מידע נוסף על לוח הסילוקין" [ref=e258] [cursor=pointer]:
                    - generic [ref=e259]: "?"
                - combobox "לוח סילוקין מידע נוסף על לוח הסילוקין" [ref=e261] [cursor=pointer]:
                  - option "שפיצר" [selected]
                  - option "קרן שווה"
            - group "מסלול 2" [ref=e262]:
              - button "הסר מסלול" [ref=e264] [cursor=pointer]: ×
              - generic [ref=e265]:
                - generic [ref=e266]:
                  - generic [ref=e267]: סוג מסלול
                  - button "מידע נוסף על סוגי המסלולים" [ref=e269] [cursor=pointer]:
                    - generic [ref=e270]: "?"
                - combobox "סוג מסלול מידע נוסף על סוגי המסלולים" [ref=e272] [cursor=pointer]:
                  - option "פריים"
                  - option "קבועה לא צמודה" [selected]
                  - option "משתנה כל 5 שנים לא צמודה"
                  - option "משתנה כל שנה לא צמודה"
                  - option "קבועה צמודה למדד"
                  - option "משתנה צמודה כל 5 שנים"
                  - option "משתנה צמודה כל שנה"
              - generic [ref=e273]:
                - text: סכום
                - generic [ref=e274]:
                  - textbox "סכום" [ref=e275]: 510,000
                  - generic [ref=e276]: ₪
              - generic [ref=e277]:
                - text: תקופה
                - generic [ref=e278]:
                  - spinbutton "תקופה 2" [ref=e279]: "15"
                  - generic [ref=e280]: שנים
              - generic [ref=e281]:
                - text: ריבית
                - generic [ref=e282]:
                  - spinbutton "ריבית 2" [ref=e283]: "4.5"
                  - generic [ref=e284]: "%"
              - generic [ref=e285]:
                - generic [ref=e286]:
                  - generic [ref=e287]: לוח סילוקין
                  - button "מידע נוסף על לוח הסילוקין" [ref=e289] [cursor=pointer]:
                    - generic [ref=e290]: "?"
                - combobox "לוח סילוקין מידע נוסף על לוח הסילוקין" [ref=e292] [cursor=pointer]:
                  - option "שפיצר" [selected]
                  - option "קרן שווה"
            - group "מסלול 3" [ref=e293]:
              - button "הסר מסלול" [ref=e295] [cursor=pointer]: ×
              - generic [ref=e296]:
                - generic [ref=e297]:
                  - generic [ref=e298]: סוג מסלול
                  - button "מידע נוסף על סוגי המסלולים" [ref=e300] [cursor=pointer]:
                    - generic [ref=e301]: "?"
                - combobox "סוג מסלול מידע נוסף על סוגי המסלולים" [ref=e303] [cursor=pointer]:
                  - option "פריים"
                  - option "קבועה לא צמודה"
                  - option "משתנה כל 5 שנים לא צמודה"
                  - option "משתנה כל שנה לא צמודה"
                  - option "קבועה צמודה למדד"
                  - option "משתנה צמודה כל 5 שנים" [selected]
                  - option "משתנה צמודה כל שנה"
              - generic [ref=e304]:
                - text: סכום
                - generic [ref=e305]:
                  - textbox "סכום" [ref=e306]: 390,000
                  - generic [ref=e307]: ₪
              - generic [ref=e308]:
                - text: תקופה
                - generic [ref=e309]:
                  - spinbutton "תקופה 3" [ref=e310]: "15"
                  - generic [ref=e311]: שנים
              - generic [ref=e312]:
                - text: ריבית
                - generic [ref=e313]:
                  - spinbutton "ריבית 3" [ref=e314]: "3"
                  - generic [ref=e315]: "%"
              - generic [ref=e316]:
                - generic [ref=e317]:
                  - generic [ref=e318]: לוח סילוקין
                  - button "מידע נוסף על לוח הסילוקין" [ref=e320] [cursor=pointer]:
                    - generic [ref=e321]: "?"
                - combobox "לוח סילוקין מידע נוסף על לוח הסילוקין" [ref=e323] [cursor=pointer]:
                  - option "שפיצר" [selected]
                  - option "קרן שווה"
          - paragraph [ref=e324]:
            - strong [ref=e325]: ⚠️
            - text: ריבית משתנה עלולה לעלות - לכן הבנק מחייב שלפחות שליש מהמשכנתא תישאר בריבית קבועה, ליציבות ההחזר שלכם.
        - group [ref=e326]:
          - generic "על עמלות פירעון מוקדם" [ref=e327] [cursor=pointer]
          - paragraph [ref=e329]: עמלת פירעון מוקדם היא הסכום שהבנק גובה כשמחזירים את המשכנתא לפני תום התקופה, כפיצוי על רווח שננעל בהסכם.
          - list [ref=e330]:
            - listitem [ref=e331]:
              - 'heading "מסלול פריים: פטור תמידי" [level=4] [ref=e332]'
              - paragraph [ref=e333]: לפי הוראות בנק ישראל, מסלול פריים פטור מעמלת פירעון מוקדם. הריבית במסלול הזה מתעדכנת יחד עם ריבית בנק ישראל, ולכן אין לבנק רווח עתידי נעול שצריך לפצות עליו.
            - listitem [ref=e334]:
              - 'heading "עדכון ריבית יותר מפעם בשנה: תחנת יציאה בכל עדכון" [level=4] [ref=e335]'
              - paragraph [ref=e336]: "במסלול שהריבית בו מתעדכנת כל שנתיים, שלוש או חמש שנים יש תחנת יציאה: בכל מועד עדכון ריבית אפשר לפרוע את המסלול בלי עמלת היוון. הפטור חל על עמלת ההיוון; עמלות תפעוליות קטנות עשויות לחול גם במסלולים האלה."
            - listitem [ref=e337]:
              - 'heading "ריבית קבועה: אין פטור" [level=4] [ref=e338]'
              - paragraph [ref=e339]: במסלול בריבית קבועה אין תחנת יציאה. אם הריבית בשוק בזמן הפירעון נמוכה מהריבית שנקבעה בהסכם, הבנק עשוי לגבות עמלת היוון.
            - listitem [ref=e340]:
              - 'heading "הנחת נאמנות: 20% אחרי 3 שנים, 30% אחרי 5 שנים" [level=4] [ref=e341]'
              - paragraph [ref=e342]: לאחר 3 שנים מתחילת ההלוואה העמלה מופחתת ב-20%, ולאחר 5 שנים ב-30%.
          - paragraph [ref=e343]: המידע כללי ואינו תלוי בנתוני החישוב שלכם, ואינו מהווה ייעוץ או הצעה. גובה העמלה נקבע בהסכם ההלוואה ובכפוף להוראות בנק ישראל.
          - link "למאמר המלא" [ref=e344] [cursor=pointer]:
            - /url: /articles/prepayment-penalties
      - generic [ref=e346]:
        - button "‏11,577 ‏₪ ההחזר החודשי הראשון שלושה מסלולים · כולל הצמדה עתידית למדד" [ref=e347] [cursor=pointer]:
          - strong [ref=e348]: ‏11,577 ‏₪
          - paragraph [ref=e349]: ההחזר החודשי הראשון
          - generic [ref=e350]: שלושה מסלולים · כולל הצמדה עתידית למדד
        - button "‏591,604 ‏₪ סך הריבית העלות הכוללת של הריבית מעבר לקרן" [ref=e351] [cursor=pointer]:
          - strong [ref=e352]: ‏591,604 ‏₪
          - paragraph [ref=e353]: סך הריבית
          - generic [ref=e354]: העלות הכוללת של הריבית מעבר לקרן
        - 'button "‏2,141,957 ‏₪ סך ההחזר ל-15 שנים כל מה שמשולם: קרן בתוספת ריבית" [ref=e355] [cursor=pointer]':
          - strong [ref=e356]: ‏2,141,957 ‏₪
          - paragraph [ref=e357]:
            - generic [ref=e358]: סך ההחזר ל-15 שנים
          - generic [ref=e359]: "כל מה שמשולם: קרן בתוספת ריבית"
        - button "הצג הכל" [ref=e360] [cursor=pointer]
      - generic [ref=e361]:
        - generic [ref=e362]:
          - heading "טבלת החזרים צפויים" [level=2] [ref=e364]
          - paragraph [ref=e365]: פריים · קבועה לא צמודה · משתנה צמודה כל 5 שנים
        - group "מעבר בין סה\"כ ולפי מסלול" [ref=e366]:
          - button "משולב" [pressed] [ref=e367] [cursor=pointer]
          - button "לפי מסלול" [ref=e368] [cursor=pointer]
        - group "מעבר בין תצוגה חודשית ושנתית" [ref=e369]:
          - button "שנתי" [pressed] [ref=e370] [cursor=pointer]
          - button "חודשי" [ref=e371] [cursor=pointer]
        - generic [ref=e373]:
          - generic [ref=e374]:
            - generic [ref=e375]: קרן
            - generic [ref=e377]: ריבית
            - generic [ref=e379]: יתרה
          - 'img "גרף החזרים: קרן וריבית לכל תקופה עם יתרת הלוואה" [ref=e381]':
            - generic [ref=e382]: ₪0
            - generic [ref=e384]: ₪50K
            - generic [ref=e386]: ₪100K
            - generic [ref=e388]: ₪150K
            - generic [ref=e390]: ₪0
            - generic [ref=e392]: ₪500K
            - generic [ref=e394]: ₪1M
            - generic [ref=e396]: ₪1.5M
            - generic [ref=e398]: "1"
            - generic [ref=e400]: "2"
            - generic [ref=e402]: "3"
            - generic [ref=e404]: "4"
            - generic [ref=e406]: "5"
            - generic [ref=e408]: "6"
            - generic [ref=e410]: "7"
            - generic [ref=e412]: "8"
            - generic [ref=e414]: "9"
            - generic [ref=e416]: "10"
            - generic [ref=e418]: "11"
            - generic [ref=e420]: "12"
            - generic [ref=e422]: "13"
            - generic [ref=e424]: "14"
            - generic [ref=e426]: "15"
            - generic [ref=e474]: תשלום שנתי
            - generic [ref=e475]: יתרה
            - generic [ref=e476]: שנה
        - generic [ref=e477]:
          - table [ref=e479]:
            - rowgroup [ref=e480]:
              - row [ref=e481]:
                - columnheader "שנה" [ref=e482]
                - columnheader "קרן" [ref=e483]
                - columnheader "ריבית" [ref=e484]
                - columnheader "תשלום שנתי" [ref=e485]
                - columnheader "יתרה" [ref=e486]
            - rowgroup [ref=e487]:
              - row [ref=e488]:
                - cell "1" [ref=e489]
                - cell "‏71,382 ‏₪" [ref=e490]
                - cell "‏67,766 ‏₪" [ref=e491]
                - cell "‏139,148 ‏₪" [ref=e492]
                - cell "‏1,433,834 ‏₪" [ref=e493]
              - row [ref=e494]:
                - cell "2" [ref=e495]
                - cell "‏75,000 ‏₪" [ref=e496]
                - cell "‏64,636 ‏₪" [ref=e497]
                - cell "‏139,636 ‏₪" [ref=e498]
                - cell "‏1,364,297 ‏₪" [ref=e499]
              - row [ref=e500]:
                - cell "3" [ref=e501]
                - cell "‏78,804 ‏₪" [ref=e502]
                - cell "‏61,327 ‏₪" [ref=e503]
                - cell "‏140,131 ‏₪" [ref=e504]
                - cell "‏1,290,700 ‏₪" [ref=e505]
              - row [ref=e506]:
                - cell "4" [ref=e507]
                - cell "‏82,805 ‏₪" [ref=e508]
                - cell "‏57,830 ‏₪" [ref=e509]
                - cell "‏140,634 ‏₪" [ref=e510]
                - cell "‏1,212,829 ‏₪" [ref=e511]
              - row [ref=e512]:
                - cell "5" [ref=e513]
                - cell "‏87,011 ‏₪" [ref=e514]
                - cell "‏54,134 ‏₪" [ref=e515]
                - cell "‏141,145 ‏₪" [ref=e516]
                - cell "‏1,130,456 ‏₪" [ref=e517]
              - row [ref=e518]:
                - cell "6" [ref=e519]
                - cell "‏91,434 ‏₪" [ref=e520]
                - cell "‏50,228 ‏₪" [ref=e521]
                - cell "‏141,663 ‏₪" [ref=e522]
                - cell "‏1,043,344 ‏₪" [ref=e523]
              - row [ref=e524]:
                - cell "7" [ref=e525]
                - cell "‏96,086 ‏₪" [ref=e526]
                - cell "‏46,102 ‏₪" [ref=e527]
                - cell "‏142,189 ‏₪" [ref=e528]
                - cell "‏951,242 ‏₪" [ref=e529]
              - row [ref=e530]:
                - cell "8" [ref=e531]
                - cell "‏100,979 ‏₪" [ref=e532]
                - cell "‏41,744 ‏₪" [ref=e533]
                - cell "‏142,722 ‏₪" [ref=e534]
                - cell "‏853,885 ‏₪" [ref=e535]
              - row [ref=e536]:
                - cell "9" [ref=e537]
                - cell "‏106,124 ‏₪" [ref=e538]
                - cell "‏37,140 ‏₪" [ref=e539]
                - cell "‏143,264 ‏₪" [ref=e540]
                - cell "‏750,996 ‏₪" [ref=e541]
              - row [ref=e542]:
                - cell "10" [ref=e543]
                - cell "‏111,535 ‏₪" [ref=e544]
                - cell "‏32,279 ‏₪" [ref=e545]
                - cell "‏143,814 ‏₪" [ref=e546]
                - cell "‏642,283 ‏₪" [ref=e547]
              - row [ref=e548]:
                - cell "11" [ref=e549]
                - cell "‏117,227 ‏₪" [ref=e550]
                - cell "‏27,145 ‏₪" [ref=e551]
                - cell "‏144,372 ‏₪" [ref=e552]
                - cell "‏527,438 ‏₪" [ref=e553]
              - row [ref=e554]:
                - cell "12" [ref=e555]
                - cell "‏123,214 ‏₪" [ref=e556]
                - cell "‏21,725 ‏₪" [ref=e557]
                - cell "‏144,939 ‏₪" [ref=e558]
                - cell "‏406,136 ‏₪" [ref=e559]
              - row [ref=e560]:
                - cell "13" [ref=e561]
                - cell "‏129,511 ‏₪" [ref=e562]
                - cell "‏16,002 ‏₪" [ref=e563]
                - cell "‏145,514 ‏₪" [ref=e564]
                - cell "‏278,039 ‏₪" [ref=e565]
              - row [ref=e566]:
                - cell "14" [ref=e567]
                - cell "‏136,136 ‏₪" [ref=e568]
                - cell "‏9,961 ‏₪" [ref=e569]
                - cell "‏146,097 ‏₪" [ref=e570]
                - cell "‏142,786 ‏₪" [ref=e571]
              - row [ref=e572]:
                - cell "15" [ref=e573]
                - cell "‏143,104 ‏₪" [ref=e574]
                - cell "‏3,585 ‏₪" [ref=e575]
                - cell "‏146,689 ‏₪" [ref=e576]
                - cell "‏0 ‏₪" [ref=e577]
          - generic [ref=e578]:
            - generic [ref=e579]:
              - img "תרשים קרן מול ריבית לכל התקופה" [ref=e580]:
                - generic [ref=e583]: ריבית
                - generic [ref=e584]: 28%
              - list [ref=e585]:
                - listitem [ref=e586]:
                  - generic [ref=e588]: קרן
                  - strong [ref=e589]: ‏1,550,353 ‏₪
                - listitem [ref=e590]:
                  - generic [ref=e592]: ריבית
                  - strong [ref=e593]: ‏591,604 ‏₪
            - paragraph [ref=e594]: יחס החזר לכל מסלול
            - complementary [ref=e595]:
              - strong [ref=e596]: פריים
              - generic [ref=e597]: ‏600,000 ‏₪ · 1.4947
            - complementary [ref=e598]:
              - strong [ref=e599]: קבועה לא צמודה
              - generic [ref=e600]: ‏510,000 ‏₪ · 1.377
            - complementary [ref=e601]:
              - strong [ref=e602]: משתנה צמודה כל 5 שנים
              - generic [ref=e603]: ‏390,000 ‏₪ · 1.3919
        - paragraph [ref=e604]:
          - link "הריביות והתחזיות עשויות להשתנות, והאישור כפוף לתנאי הבנק." [ref=e605] [cursor=pointer]:
            - /url: https://www.boi.org.il/information/bank-paymnts/financial-education/campaigns/boi-equator/mortgage/
          - text: החישוב הוא הערכה כללית ואינו כולל עמלות, ביטוחים או שינויים עתידיים בריבית.הנתונים להמחשה בלבד ואינם הצעה או אישור להלוואה.אי עמידה בהחזרים עלולה לגרור ריבית פיגורים והליכי גבייה.
  - contentinfo [ref=e606]:
    - generic [ref=e607]:
      - generic [ref=e608]: makeyev finance © 2026
      - generic [ref=e609]:
        - paragraph [ref=e610]:
          - link "ראשי" [ref=e611] [cursor=pointer]:
            - /url: /
        - text: ·
        - paragraph [ref=e612]:
          - link "מאמרים" [ref=e613] [cursor=pointer]:
            - /url: /articles
        - text: ·
        - paragraph [ref=e614]:
          - link "מחשבון משכנתא" [ref=e615] [cursor=pointer]:
            - /url: javascript:void(0);
        - text: ·
        - paragraph [ref=e616]:
          - link "השירות שלנו" [ref=e617] [cursor=pointer]:
            - /url: /services
        - text: ·
        - paragraph [ref=e618]:
          - link "צרו קשר" [ref=e619] [cursor=pointer]:
            - /url: /contact
    - generic [ref=e620]:
      - link [ref=e621] [cursor=pointer]:
        - /url: https://www.facebook.com/makeyev.finance
      - link [ref=e624] [cursor=pointer]:
        - /url: mailto:anatoly.makeyev@gmail.com?subject=I%20need%20financial%20advice!
      - link [ref=e627] [cursor=pointer]:
        - /url: https://ul.waze.com/ul?place=ChIJp9fIOZ9MHRURg5L4vD_YK1c&ll=32.05632250%2C34.76931260&navigate=yes&utm_campaign=default&utm_source=waze_website&utm_medium=lm_share_location
      - link [ref=e630] [cursor=pointer]:
        - /url: https://wa.me/972527729974?text=What's%20up%3F
      - link [ref=e633] [cursor=pointer]:
        - /url: tel:0527729974
```

# Test source

```ts
  98  | 
  99  |       if (process.env.VISUAL_QA) {
  100 |         // The other block that draws the caret, for the human pass.
  101 |         await taxBreakdown.screenshot({
  102 |           path: `${SHOT_DIR}/tax-breakdown-${language}-${viewport.tag}.png`,
  103 |         })
  104 |       }
  105 | 
  106 |       const snapshot = (await page.evaluate(
  107 |         `(() => {
  108 |           const read = (selector) => {
  109 |             const el = document.querySelector(selector)
  110 |             if (!el) return null
  111 |             const block = getComputedStyle(el)
  112 |             const summary = getComputedStyle(el.querySelector('summary'))
  113 |             return {
  114 |               fontSize: block.fontSize,
  115 |               marginTop: block.marginTop,
  116 |               summaryLineHeight: summary.lineHeight,
  117 |               summaryWeight: summary.fontWeight,
  118 |               summaryColor: summary.color,
  119 |               openSummaryGap: summary.marginBlockEnd,
  120 |             }
  121 |           }
  122 |           const noteBody = getComputedStyle(
  123 |             document.querySelector('[data-testid="prepayment-note"] .prepayment-facts p'),
  124 |           )
  125 |           return {
  126 |             note: read('[data-testid="prepayment-note"]'),
  127 |             breakdown: read('.tax-breakdown'),
  128 |             noteBodyFontSize: noteBody.fontSize,
  129 |             noteBodyLineHeight: noteBody.lineHeight,
  130 |           }
  131 |         })()`,
  132 |       )) as {
  133 |         note: Record<string, string> | null
  134 |         breakdown: Record<string, string> | null
  135 |         noteBodyFontSize: string
  136 |         noteBodyLineHeight: string
  137 |       }
  138 | 
  139 |       // Same collapsing treatment and type scale: every block- and
  140 |       // summary-level value matches the purchase-tax breakdown's, EXCEPT the
  141 |       // top gap - the note deliberately sits 20px down from the ⚠️ warning
  142 |       // (user choice; the breakdown keeps 10px), so compare the margins
  143 |       // separately and only require the note's to stay pinned.
  144 |       expect(snapshot.breakdown).not.toBeNull()
  145 |       const { marginTop: _noteMargin, ...noteRest } = snapshot.note!
  146 |       const { marginTop: _breakdownMargin, ...breakdownRest } = snapshot.breakdown!
  147 |       expect(noteRest).toEqual(breakdownRest)
  148 |       expect(_noteMargin).toBe('20px')
  149 |       // The two blocks draw their own caret instead of the UA marker (user
  150 |       // requests: the marker's 10x18px glyph can neither match the ⚠️ glyph's
  151 |       // size nor sit under the 💡). Read the live boxes: the caret against the
  152 |       // ⚠️'s ink, and the tax caret's start edge against the 💡 glyph's.
  153 |       const caret = (await page.evaluate(
  154 |         `(() => {
  155 |           const rect = (el) => {
  156 |             const r = el.getBoundingClientRect()
  157 |             return { left: r.left, right: r.right, width: r.width, height: r.height }
  158 |           }
  159 |           const warn = document.querySelector('.regulatory-note strong')
  160 |           const icon = document.querySelector('.note-line.info .note-icon')
  161 |           if (!warn || !icon) return null
  162 |           const canvas = document.createElement('canvas').getContext('2d')
  163 |           canvas.font = getComputedStyle(warn).font
  164 |           const metrics = canvas.measureText('\u26A0\uFE0F')
  165 |           const glyph = document.createRange()
  166 |           glyph.selectNodeContents(icon)
  167 |           const iconBox = glyph.getBoundingClientRect()
  168 |           const centre = (box) => (box.left + box.right) / 2
  169 |           return {
  170 |             warnInk: {
  171 |               width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
  172 |               height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
  173 |             },
  174 |             iconCentre: centre(iconBox),
  175 |             taxCaret: rect(document.querySelector('.tax-breakdown .collapse-caret')),
  176 |             noteCaret: rect(
  177 |               document.querySelector('[data-testid="prepayment-note"] .collapse-caret'),
  178 |             ),
  179 |             caretCentre: centre(document.querySelector('.tax-breakdown .collapse-caret').getBoundingClientRect()),
  180 |           }
  181 |         })()`,
  182 |       )) as {
  183 |         warnInk: { width: number; height: number }
  184 |         iconCentre: number
  185 |         taxCaret: { width: number; height: number }
  186 |         noteCaret: { width: number; height: number }
  187 |         caretCentre: number
  188 |       } | null
  189 |       expect(caret, 'warning, icon and both carets rendered').not.toBeNull()
  190 | 
  191 |       // In the ⚠️ glyph's ballpark, and square rather than the UA marker's tall
  192 |       // thin 10x18 shape. A loose band on purpose: the ⚠️'s ink depends on the
  193 |       // installed colour-emoji font, the caret's size is a dialable knob, and
  194 |       // Chrome's border snapping moves the rendered figure a pixel either way
  195 |       // depending on where the block lands on the sub-pixel grid. The
  196 |       // squareness check below is the one that catches a marker fallback.
  197 |       for (const [name, box] of Object.entries({ tax: caret?.taxCaret, note: caret?.noteCaret })) {
> 198 |         expect(box?.width, `${name} caret ~ ⚠️ width`).toBeGreaterThan(
      |                                                        ^ Error: tax caret ~ ⚠️ width
  199 |           (caret?.warnInk.width ?? 0) * 0.6,
  200 |         )
  201 |         expect(box?.width, `${name} caret ~ ⚠️ width`).toBeLessThan(
  202 |           (caret?.warnInk.width ?? 0) * 1.5,
  203 |         )
  204 |         expect(box?.height, `${name} caret ~ ⚠️ height`).toBeGreaterThan(
  205 |           (caret?.warnInk.height ?? 0) * 0.6,
  206 |         )
  207 |         expect(box?.height, `${name} caret ~ ⚠️ height`).toBeLessThan(
  208 |           (caret?.warnInk.height ?? 0) * 1.5,
  209 |         )
  210 |         // Within a pixel rather than exactly square: border widths snap to whole
  211 |         // pixels, so a notch off square is normal. The UA marker's 10x18 shape
  212 |         // is what this rules out.
  213 |         expect(
  214 |           Math.abs((box?.width ?? 0) - (box?.height ?? 0)),
  215 |           `${name} caret is square, not the UA marker`,
  216 |         ).toBeLessThanOrEqual(1)
  217 |       }
  218 | 
  219 |       // And the tax ladder's caret is centred on the 💡 above it, not sitting at
  220 |       // the bare text edge. Centres, not start edges: both are centred in the
  221 |       // notes' 1.2em icon cell, so centring is what "under the 💡" means and it
  222 |       // stays true at any caret size, where matching start edges would drift
  223 |       // apart as the caret shrinks below the glyph's width.
  224 |       expect(Math.abs((caret?.caretCentre ?? 0) - (caret?.iconCentre ?? 0))).toBeLessThanOrEqual(2)
  225 | 
  226 |       // And the note's text follows its own block size with the table cells'
  227 |       // 1.5 rhythm (the global `p` rule used to win at 20px). This is a
  228 |       // self-consistency check rather than note-vs-ladder: the generic
  229 |       // narrow-screen `td` rule written for the schedule table also hits the
  230 |       // ladder's cells, so those two body sizes diverge at 360px only.
  231 |       expect(snapshot.noteBodyFontSize).toBe(snapshot.note?.fontSize)
  232 |       expect(parseFloat(snapshot.noteBodyLineHeight)).toBeCloseTo(
  233 |         parseFloat(snapshot.noteBodyFontSize) * 1.5,
  234 |         1,
  235 |       )
  236 | 
  237 |       // The expanded note must not push the page sideways on a phone.
  238 |       const overflow = (await page.evaluate(
  239 |         'document.documentElement.scrollWidth - document.documentElement.clientWidth',
  240 |       )) as number
  241 |       expect(overflow, 'horizontal overflow').toBeLessThanOrEqual(1)
  242 | 
  243 |       if (process.env.VISUAL_QA) {
  244 |         await note.screenshot({
  245 |           path: `${SHOT_DIR}/prepayment-note-${language}-${viewport.tag}.png`,
  246 |         })
  247 |       }
  248 | 
  249 |       // Note → article.
  250 |       await note.getByRole('link').click()
  251 |       await expect(page).toHaveURL(/\/articles\/prepayment-penalties$/)
  252 | 
  253 |       const article = page.getByTestId('prepayment-penalty-article')
  254 |       await expect(article).toBeVisible()
  255 |       await expect(article.locator('li')).toHaveCount(4)
  256 |       // The article body opts into the document language's direction locally
  257 |       // (the site-wide rule keeps non-calculator pages LTR).
  258 |       await expect(article).toHaveAttribute('dir', rtl ? 'rtl' : 'ltr')
  259 | 
  260 |       if (process.env.VISUAL_QA) {
  261 |         await page.screenshot({
  262 |           path: `${SHOT_DIR}/article-${language}-${viewport.tag}.png`,
  263 |           fullPage: true,
  264 |         })
  265 |         await seedTheme(page, 'dark')
  266 |         await page.reload()
  267 |         await page.screenshot({
  268 |           path: `${SHOT_DIR}/article-dark-${language}-${viewport.tag}.png`,
  269 |           fullPage: true,
  270 |         })
  271 |       }
  272 | 
  273 |       // The articles list links to the same page. The list carries more than
  274 |       // one article now, so target this article's card via its href.
  275 |       await page.goto('/articles')
  276 |       const card = page.locator('.article-card[href="/articles/prepayment-penalties"]')
  277 |       await expect(card).toBeVisible()
  278 |       await card.click()
  279 |       await expect(page).toHaveURL(/\/articles\/prepayment-penalties$/)
  280 |       await expect(page.getByTestId('prepayment-penalty-article')).toBeVisible()
  281 |     })
  282 |   }
  283 | }
  284 | 
```