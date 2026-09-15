import type { Translation } from './he'

/**
 * English locale. Strings marked in the migration checklist as "dormant
 * English branches" were transcribed verbatim from the legacy source
 * (contact.js modal copy, offline banner, submit labels, param fallbacks);
 * calculator translations are professional new copy (the legacy calculator
 * was Hebrew-only).
 */
export const en: { translation: Translation } = {
  translation: {
    meta: {
      homeTitle: 'Makeyev Finance',
      servicesTitle: 'Our Services - Makeyev Finance',
      calculatorsTitle: 'Mortgage Calculator | Makeyev Finance',
      articlesTitle: 'Articles - Makeyev Finance',
      articlesDescription:
        'Articles and guides on mortgages and finance: prepayment penalties, track mixes and more.',
      articlesMovingChecklistDescription:
        'A moving checklist: electricity, water, arnona, gas and building committee accounts, photographing meters on moving day, the documents to gather, and returning deposits.',
      articlesPrepaymentDescription:
        'When the prepayment penalty applies: prime tracks are always exempt, rate-reset tracks have an exit point, fixed-rate tracks may be charged, and the discount grows after 3 and 5 years.',
      contactTitle: 'Contact Us - Makeyev Finance',
    },
    nav: {
      home: 'Home',
      services: 'Our Services',
      calculators: 'Mortgage Calculator',
      articles: 'Articles',
      contact: 'Contact Us',
      switchLanguage: 'עברית',
      // Theme toggle labels describe the ACTION (what clicking switches to),
      // matching the sun/moon icon the user sees.
      darkMode: 'Dark mode',
      lightMode: 'Light mode',
    },
    offlineBanner: 'no internet connection',
    footer: {
      trademark: 'makeyev finance © {{year}}',
    },
    home: {
      heroTitleLine1: 'Mortgage &',
      heroTitleLine2: 'Financial Advice',
      // Legacy parity: the hero underline stays Hebrew even in English
      // (the original index.html always rendered the Hebrew tagline there).
      heroSubtitle: 'ייעוץ משכנתאות ופיננסים',
      heroCta: 'Schedule a free consultation call',
      coursesTitle: 'Courses',
      sectionSubtitle: 'lorem ipsums sin omitt lorem ipsums sin omitt',
      courseIntermediate: 'intermediate',
      courseDegree: 'degree',
      coursePostGrad: 'post grad',
      courseBody:
        'asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd asd',
      campusTitle: 'Global campus',
      cityNewYork: 'new york',
      cityLondon: 'london',
      cityWashington: 'washington',
      facilitiesTitle: 'facilities',
      facilityLibrary: 'world class library',
      facilityPlayground: 'largest playground',
      facilityCafeteria: 'huge ass cafeteria',
      shortBody: 'asd asd asd asd asd asd asd asd asd asd asd asd asd asd',
      testimonialKriso: 'Kriso',
      testimonialEsterbon: 'Esterbon',
      actionTitle: 'Schedule a free call now',
      actionCta: 'contact us',
    },
    services: {
      title: 'Our Services',
      subtitle: 'Lorem ipsum sin omitt Lorem ipsum sin omitt',
      cardTitle: 'Lorem ipsum dolor sit amet consectetur',
      cardBody:
        'distinctio officiis tenetur hic repellat? Voluptate quasi, ipsa debitis iste sint tempora doloremque distinctio quos? distinctio officiis tenetur hic repellat? Voluptate quasi, ipsa debitis iste sint tempora doloremque distinctio quos? lorem epsium omitti baguette du omelette du fromage',
      explore: 'explore now',
    },
    articles: {
      title: 'Articles',
      subtitle: 'Lorem ipsum sin omitt Lorem ipsum sin omitt',
      listHeading: 'All articles',
      prepayment: {
        title: 'Mortgage prepayment penalties',
        summary:
          'Prime tracks are always exempt, tracks that reset more than once a year have an exit point, fixed-rate tracks may be charged, and the discount grows after 3 and 5 years.',
        cta: 'Read the article',
      },
      movingChecklist: {
        title: 'What to transfer when you move apartments',
        summary:
          'A moving checklist: electricity, water, arnona, gas and building committee accounts, photographing meters on moving day, the documents to gather, and returning deposits.',
        cta: 'Read the article',
      },
    },
    /* General educational content, not tied to any calculation. Both the
       calculator's collapsible note and the article page read these keys, so
       the four facts are written once per language. */
    education: {
      movingChecklist: {
        intro:
          "Moving is where small forgotten things get expensive: accounts left in the previous resident's name, meters nobody photographed, deposits left with the landlord. This list gathers what actually needs transferring, and in what order.",
        documentsLead:
          'Before you start: gather the documents every provider will ask for up front, instead of chasing them one at a time. Usually required: a signed lease or purchase agreement, the ID of both the outgoing and incoming resident, and often a photocopy of the ID including the sefach (the ID attachment page).',
        sections: {
          municipalities: {
            title: 'Municipal tax (arnona)',
            items: [
              'Close the arnona (municipal tax) account of the apartment you are leaving and switch the account to the new payer, in both apartments.',
              'Ask for written confirmation that the account was updated, and keep it.',
              'Note: if previous residents left without transferring the account, arnona debts can land on the owner or the new resident. Do not assume the account is in order - check it.',
            ],
          },
          utilities: {
            title: 'Electricity, water, gas and the building committee',
            items: [
              'Electricity: close the account and switch it to the new payer.',
              'Water: close the account and switch it to the new payer (per your local provider).',
              'Gas: close the account and switch it to the new payer.',
              'Building committee (vaad bayit): close the account and switch it to the new payer, via the committee or the management company.',
            ],
          },
          meters: {
            title: 'Photograph the meters on moving day',
            items: [
              'Photograph the electricity meter and the water meter on move-in day and on move-out day, with a clear reading.',
              "Why it matters: without a dated photo of the reading, you can end up billed for the previous or next occupant's usage.",
              "Document the apartment's condition with photos and video on move-in and move-out day, next to the meter shots, to prevent damage disputes.",
            ],
            callout:
              'Property owners: if outgoing residents leave without transferring accounts into their own names, and new residents do not register in time, the debt can land on you as the owner. Make sure the accounts were actually updated, not just "in process".',
          },
          logistics: {
            title: 'Mail, communications and parking',
            items: [
              'Mail: update the address and names with the services that send you important mail.',
              'TV, internet and phone: depends on the tenant - close or transfer as needed.',
              'Parking (if there is one): get a proper walkthrough of the parking arrangement (robotic parking, a lift, or stacked spaces) and hand over the parking chip.',
            ],
          },
          deposits: {
            title: 'Deposits',
            items: [
              'After confirming that no debts remain, return the deposits to the previous tenant.',
            ],
          },
        },
        timing:
          'Transferring accounts usually takes a few business days once submitted. Start early enough before your move date so the accounts actually switch on move-in day.',
        disclaimer:
          'This information is general and is not advice. Some services are handled per municipality, and requirements and channels may change - check with the provider for your address.',
        backToArticles: 'Back to all articles',
      },
      prepaymentPenalty: {
        title: 'About prepayment penalties',
        lead: 'A prepayment penalty is what the bank charges for repaying the mortgage before the term ends, as compensation for the profit locked into the loan.',
        facts: {
          prime: {
            title: 'Prime tracks: always exempt',
            text: 'Under Bank of Israel rules, a prime track is exempt from the prepayment penalty. Its rate follows the Bank of Israel rate, so the bank has no locked-in future profit to be compensated for.',
          },
          reset: {
            title: 'Resets more than once a year: an exit point at every reset',
            text: 'A track whose rate resets every two, three or five years has an exit point: at every rate reset you can repay it without the discounting penalty (עמלת היוון). That exemption covers the discounting penalty; small operational fees may still apply on these tracks.',
          },
          fixed: {
            title: 'Fixed-rate tracks: no exemption',
            text: 'A fixed-rate track has no exit point. If market rates at repayment time are lower than the rate fixed in the agreement, the bank may charge the discounting penalty.',
          },
          loyalty: {
            title: 'Loyalty discount: 20% off after 3 years, 30% after 5 years',
            text: 'After 3 years from the start of the loan the penalty is reduced by 20%, and after 5 years by 30%.',
          },
        },
        whyPrime:
          'The difference comes from prime already tracking the Bank of Israel variable rate, so the bank has no future profit locked into the agreement that early repayment takes away. On a fixed-rate track the bank committed to a fixed rate for years, and repaying early when market rates have fallen takes away that gap.',
        timing:
          'Before repaying early, ask the bank for the fee breakdown in writing and check when the next rate reset of the track falls ~ sometimes waiting for the reset saves the whole penalty.',
        disclaimer:
          'This information is general, does not depend on your calculation, and is not advice or an offer. The penalty is set by the loan agreement and by Bank of Israel rules.',
        articleLink: 'Read the full article',
        backToArticles: 'Back to all articles',
      },
    },
    contact: {
      headerTitle: 'Free Consultation Call',
      formTitle: 'Leave your details',
      formSubtitle:
        "We'll save you money on a new or existing mortgage\non terms that fit you - not the bank",
      nameLabel: 'Name',
      phoneLabel: 'Number',
      emailLabel: 'Email',
      messageLabel: 'How can we help you',
      submit: 'Send',
      sending: 'Sending',
      callback: {
        label: 'When should we get back to you',
        emailLabel: 'Preferred callback time',
        morning: 'Morning',
        noon: 'Noon',
        evening: 'Evening',
        morningHours: '08:00–12:00',
        noonHours: '12:00–16:00',
        eveningHours: '16:00–20:00',
      },
      validation: {
        nameRequired: 'Please enter your name',
        nameInvalid: 'Name is not valid',
        phoneRequired: 'Please enter a phone number',
        phoneInvalid: 'Phone number is not valid',
        emailInvalid: 'Email address is not valid',
      },
      modal: {
        successTitle: 'message sent!',
        successUser: 'Thanks {{name}},',
        successBody: 'we will get back to you as soon as possible',
        failureTitle: 'Oops!',
        failureBodyPrefix:
          'there seems to be a problem with your internet connection, feel free to reach us at ~ ',
        failureBodySuffix: '',
        blockedDevice: 'Something on this device is blocking us from sending messages',
        emailNotProvided: 'Was not included',
        defaultAdviceMessage: 'I would like some advice',
        backHome: 'Home',
        ourServices: 'Our Services',
        articles: 'Articles',
      },
      actionModal: {
        title: 'Leave your details',
        subtitle: "We'll get back to you soon",
      },
    },
    calculator: {
      panelHeading: 'Plan your monthly payment and total cost',
      reset: 'Reset data',
      resetConfirmTitle: 'Reset all data?',
      resetConfirmMessage: 'This will clear all entered data and cannot be undone',
      resetConfirm: 'Reset',
      resetCancel: 'Cancel',
      startingAmountLabel: 'Mortgage amount',
      termLabel: 'Mortgage term in years',
      showPayments: 'Show payments',
      purposeLabel: 'Purpose of purchase',
      purposeFirst: 'First home (75% financing)',
      purposeUpgrade: 'Home upgrade (70% financing)',
      purposeInvestment: 'Investment property (50% financing)',
      propertyValueLabel: 'Property value',
      capitalLabel: 'Initial capital',
      incomeLabel: 'Net monthly income',
      realtorPercentLabel: 'Realtor fee',
      lawyerPercentLabel: 'Lawyer fee',
      appraiserFeeLabel: 'Appraiser fee',
      renovationsLabel: 'Renovations',
      realtorAmountLabel: 'Realtor fee - amount incl. VAT',
      lawyerAmountLabel: 'Lawyer fee - amount incl. VAT',
      lawyerFloorNote: 'Minimum lawyer fee applies: {{amount}} (VAT included)',
      feeVatIncluded: 'Amounts include VAT',
      ptiThresholdLabel: 'Payment share of income',
      ptiThresholdSuffix: 'of income',
      ptiHint:
        'Suggested payment: the mortgage payment together with additional monthly expenses should not exceed {{threshold}}% of income.',
      expenseLabel: 'Expense description',
      expenseLabelAria: 'Description of the additional expense',
      expenseAmountLabel: 'Monthly payment',
      expenseOneTimeAmountLabel: 'One-time payment',
      otherExpensesAdd: 'Add expense',
      expenseRemove: 'Remove expense',
      presetHeading: 'Choose a mix',
      presetBasket1: 'Mix 1',
      presetBasket2: 'Mix 2',
      presetBasket3: 'Mix 3',
      presetBasket4: 'Recommended mix',
      addTrack: 'Add track +',
      autofix: 'Auto-fix mix',
      noNeed: 'No need 🥳',
      regulatoryNote:
        'Variable rates can rise - the bank requires that at least one third of the mortgage remain at a fixed rate, for the stability of your payments.',
      disclaimer:
        'This calculation is a general estimate and does not include fees, insurance or future rate changes.',
      legalNotePart1: 'Data is for illustration only and is not an offer or approval of a loan.',
      legalNoteLink: 'Rates and forecasts may change; approval is subject to bank terms.',
      legalNoteLinkUrl:
        'https://www.boi.org.il/en/information-and-service-to-the-public/banking-customer-service-information/financial-education/campaigns/boi-equalizer/',
      legalNoteRisk:
        'Failure to meet payments may incur late-payment interest and collection proceedings.',
      feeLabels: {
        realtor: 'realtor',
        lawyer: 'lawyer',
        appraiser: 'appraiser',
        expense: 'expense',
        renovations: 'renovations',
      },
      track: {
        legend: 'Track {{index}}',
        removeAria: 'Remove track',
        typeLabel: 'Track type',
        amountLabel: 'Amount',
        yearsLabel: 'Term',
        yearsSuffix: 'years',
        rateLabel: 'Rate',
        methodLabel: 'Amortization',
        methodSpitzer: 'Spitzer',
        methodEqualPrincipal: 'Equal principal',
      },
      trackTypes: {
        prime: 'Prime',
        fixed: 'Fixed non-indexed',
        variable5y: 'Variable every 5 years non-indexed',
        variable: 'Variable yearly non-indexed',
        fixedIndexed: 'Fixed CPI-indexed',
        variableIndexed5y: 'Variable indexed every 5 years',
        variableIndexed: 'Variable indexed yearly',
      },
      counts: {
        one: 'one track',
        two: 'two tracks',
        three: 'three tracks',
        many: '{{count}} tracks',
      },
      results: {
        firstPaymentCard: 'First monthly payment',
        highestPaymentDefault: 'Highest estimated monthly payment',
        highestCaption: 'Largest payment across the whole term, per indexation',
        totalInterestCard: 'Total interest',
        interestCaption: 'Extra cost of borrowing beyond the principal',
        totalPaymentCaption: 'Everything repaid: principal plus interest',
        totalForYearsPrefix: 'Total payments over ',
        totalForYearsSuffix: ' years',
        totalOneYear: 'Total payments for one year',
        defaultPaymentNote: 'Assuming a fixed rate for the entire term',
        overpayCard: 'Total cost of credit',
        overpayCaption: 'How much extra you repay on top of the principal',
        avgPaymentCard: 'Average payment',
        avgPaymentCaption: 'Total cost divided evenly across every month of the term',
        interestShareCard: 'Interest of first payment',
        interestShareCaption: 'Early annuity payments go mostly to interest, not principal',
        balance5yCard: 'Balance after 5 years',
        balance5yCaption: 'Debt still owed after 5 years ~ for refinance or sale',
        rateUpCard: 'If rates rise by 1%',
        rateUpCaption: 'First payment with every variable rate +1 point (+{{delta}}%)',
        rateUpCaptionFixed: 'No variable-rate tracks ~ your payment is locked for the whole term',
        rateDownCard: 'If rates drop by 1%',
        rateDownCaption: 'First payment with every variable rate −1 point ({{delta}}%)',
        rateDownCaptionFixed: 'No variable-rate tracks ~ your payment is locked for the whole term',
        fiveYInterestCard: 'Interest of the first 5 years',
        fiveYInterestCaption: 'Share of interest in the first 5 years of payments',
        per100kCard: 'Payment per ₪100k',
        per100kCaption: 'Monthly cost scaled to ₪100k ~ compare offers fairly',
        avgRateCard: 'Average interest rate',
        avgRateCaption: 'Simple average of track rates; loan-weighted: {{weighted}}%',
        avgPaybackCard: 'Average payback ratio',
        avgPaybackCaption: 'Total repaid per shekel borrowed, interest included',
        effRateCard: 'Effective annual rate',
        effRateCaption: 'True yearly cost, monthly compounding of {{nominal}}% nominal',
        paybackPerTrackTitle: 'Payback ratio per track',
        showAll: 'Show all',
        showLess: 'Show less',
        gotIt: 'Got it',
        details: {
          firstPayment:
            'The payment you make in the first month after taking the mortgage, based on every track, amount and rate you entered. With a Spitzer schedule the payment stays constant, while variable or CPI-indexed tracks may change over time. This is the starting point for planning your monthly budget.',
          totalInterest:
            'The total amount you pay the bank beyond the principal ~ the interest accrued on the loan over the whole term. Higher rates or longer terms mean more total interest. To reduce it: raise your down payment, shorten the term, or get a better rate.',
          totalPayment:
            'All payments over the life of the mortgage ~ principal and interest combined. This is the number that matters when comparing offers: a low monthly payment over a long term can still add up to a higher total cost.',
          rateUp:
            'What would happen to your first monthly payment if every variable-rate track rose by 1%. It is a stress scenario showing how sensitive your payment is to rate increases. Fixed-rate tracks are unaffected.',
          rateDown:
            'What would happen to your first monthly payment if every variable-rate track dropped by 1%. It shows the upside of variable rates: when market rates fall, so does your monthly payment.',
          highestPayment:
            'The highest monthly payment expected over the whole term. With CPI-indexed tracks the payment can rise with inflation, so the peak is not necessarily the first month. Make sure this payment still fits comfortably in your budget.',
          avgPayment:
            'All payments over the term divided by the number of months. A useful average for quick comparisons between mixes ~ but remember the actual payment varies month to month.',
          overpayPercent:
            'How much you repay beyond the principal, as a percentage of the loan amount. For example, 50% means you repay ₪1.50 for every ₪1 you borrowed. The lower the percentage, the cheaper the loan.',
          avgPayback:
            'The ratio of total repayment to the loan amount. A ratio of 1.5 means you repay ₪1.50 for every shekel borrowed, interest included. A handy metric for quickly comparing different offers.',
          avgRate:
            'The simple average of the rates across your tracks. The rate you actually pay may differ because each track is weighted by its loan amount. For precision, check the effective rate.',
          effRate:
            'The true annual cost of the loan, accounting for monthly compounding. It is always slightly higher than the nominal rate, because interest accrues on itself every month. This is the right number for comparing offers.',
          interestShare:
            'The share of your first monthly payment that goes to interest rather than principal. With a Spitzer schedule, early payments are almost all interest ~ the principal is repaid mainly toward the end of the term.',
          fiveYInterest:
            'The share of interest in all payments during the first five years. Useful when planning an early refinance or sale: early payments are mostly interest, so the debt shrinks slowly at first.',
          balance5y:
            'The debt still owed after five years of payments. Early payments go mostly to interest, so a large share of the principal remains after five years. Key figure for refinancing or selling.',
          per100k:
            'Your monthly payment scaled to every ₪100,000 of the loan. This removes loan size from the equation, letting you fairly compare bank offers with different rates and terms.',
        },
        links: {
          guide: {
            label: 'Bank of Israel – mortgage rates, tracks and total cost',
            url: 'https://www.boi.org.il/en/information-and-service-to-the-public/banking-customer-service-information/financial-education/campaigns/boi-equalizer/',
          },
          interest: {
            label: 'Bank of Israel – effective vs nominal interest rate',
            url: 'https://www.boi.org.il/en/information-and-service-to-the-public/tools-and-calculators/nominal-effective-interest-rate-calculator/',
          },
          compare: {
            label: 'Bank of Israel – mortgage rate comparison',
            url: 'https://www.boi.org.il/en/information-and-service-to-the-public/banking-customer-service-information/financial-education/campaigns/boi-equalizer/',
          },
          rates: {
            label: 'Bank of Israel – current mortgage interest rates',
            url: 'https://www.boi.org.il/en/information-and-service-to-the-public/banking-customer-service-information/financial-education/campaigns/boi-equalizer/',
          },
          cpi: {
            label: 'Consumer Price Index – Israel Central Bureau of Statistics',
            url: 'https://www.cbs.gov.il/en/subjects/Pages/consumer-price-index.aspx',
          },
        },
      },
      charts: {
        amortAria: 'Amortization chart: principal and interest per period with the loan balance',
        mixAria: 'Track-mix donut chart',
        costAria: 'Principal versus interest over the full term',
        perTrackAria: 'Per-track balance comparison over the term',
        mixTotalLabel: 'Total mortgage',
        costCenterLabel: 'interest',
        yearLabel: 'Year {{year}}',
        monthLabel: 'Month {{month}}',
        axisPayment: 'Annual payment',
        axisMonthlyPayment: 'Monthly payment',
        axisBalance: 'Balance',
        axisYear: 'Year',
      },
      dynamicNotes: {
        indexedLabel: 'Highest payment',
        indexedNote: 'Includes future CPI indexation',
        equalPrincipalLabel: 'First monthly payment ',
        equalPrincipalNote: 'With equal principal, the payment decreases over the years',
        variableLabel: 'Current monthly payment',
        variableFiveYearNote:
          'Variable rates are guaranteed only until their reset date (every 5 years)',
        variableNote: 'Assumes rates stay unchanged (in practice they may change)',
        fixedLabel: 'Fixed monthly payment',
        fixedNote: 'A non-indexed Spitzer mix keeps the payment constant throughout',
      },
      emptyNote: 'Add a track to get started',
      errors: {
        termRange: 'The loan term must be between 1 and 30 years.',
        positiveAmounts: 'Please enter a positive amount in each track',
        variableCapLine1:
          'Per Bank of Israel, variable-rate tracks marked below cannot exceed 66.66% of the total mortgage',
        variableCapLine2: ' Reduce a marked track or increase a fixed-rate track',
      },
      warnings: {
        capital: 'Capital is <0>{{percent}}%</0> of the property value',
        capitalLtvOk:
          'Capital is <0>{{capitalPercent}}%</0> of the property value ~ within the limit for a {{purpose}} (up to <1>{{limit}}%</1>)',
        capitalShortfall:
          'Capital is below the required share ~ at least <0>{{required}}</0> (<1>{{requiredPercent}}%</1>) is needed',
        capitalPercentRequired:
          'Capital of <0>{{percent}}%</0> of the property value ~ at least <1>{{required}}</1> (<2>{{requiredPercent}}%</2>) required',
        purchaseTaxNone:
          'Purchase tax is not applicable for a {{purpose}} up to a value of <0>{{threshold}}</0>',
        purchaseTax: 'Purchase tax ({{purpose}}): <0>{{amount}}</0> (<1>{{percent}}%</1>)',
        purchaseTaxFirst: 'first home',
        purchaseTaxUpgrade: 'home improver',
        purchaseTaxInvestment: 'second home and beyond',
        ltv: 'The financing ratio (<0>{{percent}}%</0>) exceeds the Bank of Israel limit for a {{purpose}} (up to <1>{{limit}}%</1>)',
        ltvMaxLoan:
          'You can get a mortgage up to <0>{{maxLoan}}</0> with initial capital of <1>{{requiredCapital}}</1> for a property at this value',
        ltvOk:
          'The financing ratio (<0>{{percent}}%</0>) is within the limit for a {{purpose}} (up to <1>{{limit}}%</1>)',
        // English CLDR uses one/other; _two duplicates _other because Hebrew
        // (the reference key set) requires the key to exist (see parity test).
        requiredPayment_one:
          'The monthly payment for a <0>{{term}}</0>-year term will be <1>{{payment}}</1>',
        requiredPayment_two:
          'The monthly payment for a <0>{{term}}</0>-year term will be <1>{{payment}}</1>',
        requiredPayment_other:
          'The monthly payment for a <0>{{term}}</0>-year term will be <1>{{payment}}</1>',
        monthlyAllowanceOk:
          'The monthly payment of <0>{{payment}}</0> is below the recommended ceiling of <1>{{allowed}}</1> a month (<2>{{percent}}%</2> of income of <3>{{income}}</3> minus <4>{{liabilities}}</4>)',
        monthlyAllowanceOkNoLiabilities:
          'The monthly payment of <0>{{payment}}</0> is below the recommended ceiling of <1>{{allowed}}</1> a month (<2>{{percent}}%</2> of income of <3>{{income}}</3>)',
        monthlyAllowanceOver:
          'The income is not enough for the expected monthly payment of <0>{{payment}}</0> (<1>{{percent}}%</1> of <2>{{income}}</2> minus <3>{{liabilities}}</3>) - at least <4>{{minIncome}}</4> is needed',
        monthlyAllowanceOverNoLiabilities:
          'The income is not enough for the expected monthly payment of <0>{{payment}}</0> (<1>{{percent}}%</1> of <2>{{income}}</2>) - at least <3>{{minIncome}}</3> is needed',
        monthlyAllowanceNone_one:
          'No room for a mortgage payment over a <0>{{term}}</0>-year term: the monthly payments (<1>{{liabilities}}</1>) already cover the income (<2>{{income}}</2>)',
        monthlyAllowanceNone_two:
          'No room for a mortgage payment over a <0>{{term}}</0>-year term: the monthly payments (<1>{{liabilities}}</1>) already cover the income (<2>{{income}}</2>)',
        monthlyAllowanceNone_other:
          'No room for a mortgage payment over a <0>{{term}}</0>-year term: the monthly payments (<1>{{liabilities}}</1>) already cover the income (<2>{{income}}</2>)',
        feeAboveNormItem:
          'Payment of <0>{{percent}}%</0> for {{fee}} is above the market norm of <1>{{normPercent}}%</1> (<2>{{normAmount}}</2>)',
        transactionCosts: 'Expected transaction fees: {{items}}',
        upfrontTotal: 'Total capital recommended to complete the deal: <0>{{total}}</0>',
        purposeFirst: 'first home',
        purposeUpgrade: 'home upgrade',
        purposeInvestment: 'investment property',
      },
      taxBreakdown: {
        title: 'Purchase tax breakdown',
        rateHeader: 'Bracket',
        rangeHeader: 'Range',
        taxableHeader: 'Taxable amount',
        taxHeader: 'Tax due',
        rangeUpTo: 'up to <0>{{to}}</0>',
        rangeBetween: '<0>{{from}}</0> ~ <1>{{to}}</1>',
        rangeAbove: '<0>{{from}}</0> and above',
        total: 'Total tax due',
        current: 'Current bracket',
        notReached: '-',
      },
      schedule: {
        heading: 'Expected payments table',
        viewToggleAria: 'Switch between total and per-track',
        viewTotal: 'Total',
        viewSeparate: 'Per track',
        granularityToggleAria: 'Switch between monthly and yearly rows',
        granularityMonthly: 'Monthly',
        granularityYearly: 'Yearly',
        monthHeader: 'Year · Month',
        monthTotalHeader: 'Total months',
        yearHeader: 'Year',
        principalHeader: 'Principal',
        interestHeader: 'Interest',
        annualPaymentHeader: 'Annual payment',
        balanceHeader: 'Balance',
        asideTitle: 'First annual payment',
        asideCaption: 'Sum of payments in the first 12 months',
        paybackHeader: 'Payback ratio',
        paybackRatioLabel: 'Payback ratio',
        expandToYears: 'Show breakdown for {{years}} years',
        collapseToFifteen: 'Show first 15 years',
      },
    },
    compare: {
      metaTitle: 'Mortgage comparison | Makeyev Finance',
      heading: 'Mortgage scenario comparison',
      subtitle: 'Same property, same capital, same income - different mortgage mixes side by side.',
      openFromCalculator: 'Compare mixes',
      // Shared inputs (describing the buyer and the property, entered once).
      sharedInputsHeading: 'Property and buyer',
      purposeLabel: 'Purpose of purchase',
      propertyValueLabel: 'Property value',
      capitalLabel: 'Initial capital',
      incomeLabel: 'Net monthly income',
      // Scenario column/section headers.
      scenarioLabelAria: 'Scenario name',
      scenarioUntitle: 'Scenario {{index}}',
      scenarioRemove: 'Remove scenario',
      scenarioDuplicate: 'Duplicate scenario',
      scenarioAdd: 'Add scenario +',
      scenarioTermLabel: 'Term',
      scenarioTermSuffix: 'years',
      trackAdd: 'Add track +',
      trackLegend: 'Track {{index}}',
      trackRemoveAria: 'Remove track',
      trackAmountLabel: 'Amount',
      trackYearsLabel: 'Term',
      trackYearsSuffix: 'years',
      trackRateLabel: 'Rate',
      trackTypeLabel: 'Track type',
      trackMethodLabel: 'Amortization',
      // Comparison table: metric rows (vocabulary mirrors calculator.results).
      metricFirstPayment: 'First monthly payment',
      metricRateUp: 'If rates rise by 1%',
      metricTotalPayment: 'Total payments over {{years}} years',
      metricTotalInterest: 'Total interest',
      metricWeightedRate: 'Weighted average rate',
      metricOverpay: 'Total cost of credit',
      metricPayback: 'Average payback ratio',
      metricTerm: 'Term',
      metricTermValue: '{{years}} years',
      metricMix: 'Track mix',
      metricUpfront: 'Total capital recommended to complete the deal',
      metricLoan: 'Total mortgage',
      // Regulatory status per scenario.
      statusHeading: 'Regulatory status',
      statusLtvOk: 'Financing within limit',
      statusLtvOver: 'Financing above the limit ({{percent}}% over {{limit}}%)',
      statusDtiOk: 'Income sufficient (DTI)',
      statusDtiOver: 'DTI: income of at least {{minIncome}} required',
      statusPtiOk: 'Payment within the recommended ceiling',
      statusPtiOver: 'Above the {{threshold}}%-of-income payment ceiling',
      statusEmpty: 'Add tracks to see figures',
      statusErrorPositive: 'Enter a positive amount and a 1-30 year term in every track',
      statusErrorVariableCap: 'Exceeds the Bank of Israel two-thirds variable-rate cap',
      // Mobile stacked view.
      scenarioSwitcherAria: 'Switch between scenarios',
      bestBadge: 'Best',
      disclaimer:
        'This comparison uses the same calculations as the main calculator and is a general estimate only - not an offer or loan approval.',
    },
    indexesBar: {
      monthlyChange: 'Monthly change',
      yearlyChange: 'Yearly change',
      ariaLabel: 'Price indexes',
      // Short English labels for the CBS index names (the CBS feed only
      // publishes Hebrew names).
      shortNames: {
        cpi: 'CPI',
        residentialConstruction: 'Residential input',
        commercialConstruction: 'Commercial input',
      },
    },
    marketTracker: {
      ariaLabel: 'Market prices',
      proxyOf: 'Tracks {{proxy}}',
      indexPoints: 'Index level in points',
      futuresNote: 'COMEX front-month futures, above the spot price',
      staleTooltip: 'Cached data, may be out of date',
      assets: {
        sp500: 'SPY',
        nasdaq: 'QQQ',
        ta35: 'TA-35',
        gold: 'GOLD',
        bitcoin: 'BTC',
        usdils: 'USD/ILS',
      },
    },
    wishlist: {
      save: 'Save topic',
      saved: 'Saved',
      badge: 'Saved topics · {{count}}',
      badgeAria: 'Open your saved topics',
      panelTitle: 'Your saved topics',
      panelHint: 'Saved topics are attached to the message you send through the contact form',
      send: 'Send via the contact form',
      removeAria: 'Remove {{title}} from the list',
      addedToast: 'Topic added to your saved topics',
      removedToast: 'Topic removed from your saved topics',
      formTitle: 'Your saved topics',
      emailTopicsTitle: 'Topics saved from the calculator',
      emailQuestion: 'Topic {{number}}',
      emailSnapshotTitle: 'Calculator details',
    },
  },
}
