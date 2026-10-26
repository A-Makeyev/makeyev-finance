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
      homeDescription:
        'Mortgage and financial advice: a mortgage calculator, articles and financial guidance.',
      servicesTitle: 'Our Services - Makeyev Finance',
      calculatorsTitle: 'Mortgage Calculator | Makeyev Finance',
      articlesTitle: 'Articles - Makeyev Finance',
      articlesDescription:
        'Articles and guides on mortgages and finance: prepayment penalties, track mixes and more.',
      articlesMovingChecklistDescription:
        'A moving checklist: electricity, water, arnona, gas and building committee accounts, photographing meters on moving day, the documents to gather, and returning deposits.',
      articlesPrepaymentDescription:
        'When the prepayment penalty applies: prime tracks are always exempt, rate-reset tracks have an exit point, fixed-rate tracks may be charged, and the discount grows after 3 and 5 years.',
      articlesTrackTypesDescription:
        'A guide to mortgage track types: prime, fixed non-indexed and variable, CPI indexation, Spitzer versus equal principal, and why a mix of tracks balances certainty against cost.',
      articlesMortgageDecisionsDescription:
        'Three practical mortgage questions: what each ready-made mix contains and what risk it carries, which track to prepay first, and Spitzer versus equal principal as a whole-loan decision.',
      contactTitle: 'Contact Us - Makeyev Finance',
      ratesTitle: 'Average Mortgage Rates | Makeyev Finance',
      ratesDescription:
        'Bank of Israel average rates on new mortgages by period to repayment, CPI-indexed and non-indexed.',
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
    heroScrollCue: {
      aria: 'Scroll to the content below the banner',
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
      trackTypes: {
        title: 'Mortgage track types',
        summary:
          'The difference between prime, fixed non-indexed and variable tracks, how CPI indexation works, what Spitzer versus equal principal changes, and why tracks get mixed.',
        cta: 'Read the article',
      },
      mortgageDecisions: {
        title: 'The mortgage mix, prepayment order and amortization',
        summary:
          'What each ready-made mix contains and how to choose between them, which track to prepay first, and Spitzer versus equal principal as a whole-loan decision.',
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
            title: 'Annual or five-year resets: an exit point at every reset',
            text: 'A track whose rate resets every year or every five years has an exit point: at every rate reset you can repay it without the discounting penalty (עמלת היוון). An annually-reset track is exempt throughout; a five-year track is exempt on the reset date itself. Small operational fees may still apply.',
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
      trackTypes: {
        intro:
          'Banks offer several types of track, and each behaves differently over the years. The differences between them decide how much your monthly payment is likely to move, when you can leave a track without a fee, and what happens to the debt itself when inflation rises. This is the part that actually matters when choosing a mortgage, more than any single number.',
        blocks: {
          title: 'The three building blocks, and where indexation fits',
          prime: {
            title: 'Prime',
            text: 'A variable rate made up of the Bank of Israel rate plus a fixed margin of about 1.5% that the banks add. When the Bank of Israel raises or lowers its rate (up to eight decisions a year), the payment on this track follows. Prime carries no prepayment penalty, so you can leave it at any time without a fee.',
          },
          fixed: {
            title: 'Fixed non-indexed',
            text: 'The rate is locked for the whole loan term, and the monthly payment does not change even when the market moves. The price of that certainty is a higher starting rate than the variable options. There is no penalty-free exit point here.',
          },
          variable: {
            title: 'Variable (not prime)',
            text: 'The rate resets at fixed intervals - every two, three or five years, depending on the track. Until the next reset it behaves like a fixed rate, and each reset is a real exit point: you can repay that part without the discounting penalty, refinance or close the mortgage. Its rate is based on a reference rate the bank sets, not on prime.',
          },
          indexed: {
            title: 'CPI indexation',
            text: 'Any of the tracks above can also be linked to the Consumer Price Index. Indexation does not only affect future payments - it grows the outstanding principal itself with inflation. For example: 3% annual indexation grows the remaining balance by roughly 3% that year, on top of the interest and the payments you make. That is a materially different risk from a non-indexed track at the same nominal rate.',
          },
        },
        primePenaltyNote:
          'We cover the penalty on the other track types, and when an exemption exit point exists, in a separate article:',
        prepaymentLink: 'Mortgage prepayment penalties',
        methods: {
          title: 'Spitzer versus equal principal',
          spitzer:
            'Spitzer (the standard amortization schedule): the total monthly payment stays constant, but its make-up shifts - early payments are mostly interest, later ones mostly principal.',
          equalPrincipal:
            'Equal principal: the principal part of the payment is constant, so the total payment starts higher and declines over time, as interest is charged on a shrinking balance.',
          note: 'This is a secondary distinction next to the choice of track type: it changes the pace of repayment over the years, not the nature of the risk. In the calculator you can pick the repayment method for each track separately.',
          deeperNote:
            'For the choice between the schedules as a borrower-level, whole-loan decision, plus two more practical decisions - which ready-made mix to start from and which track to prepay first - we wrote a follow-up article:',
          deeperLink: 'The mortgage mix, prepayment order and amortization',
        },
        mix: {
          title: 'Why tracks are mixed (the mix)',
          body: 'One mortgage can be split across several tracks, up to three in the calculator. Blending a fixed track with a variable one balances the certainty of a fixed payment against the lower cost of variable tracks, and so the exposure to rate changes.',
          limit:
            'The regulation is built on the same idea: under Bank of Israel rules, the variable-rate part of the loan may not exceed 66.66% of the total mortgage, which means at least a third (33.33%) must sit in a track whose rate is not variable. The calculator enforces that ceiling and warns when it is crossed.',
        },
        choosing: {
          title: 'How to think about the choice',
          body: 'There is no single right answer - the question is how much uncertainty you can take. A fixed track suits someone who wants a predictable payment for the whole term, even at a higher rate; a prime or variable track suits someone who prefers the lower cost and can absorb a higher payment.',
          terms:
            'Another question is how long you expect to stay in this loan. If you plan to refinance or sell in a few years, a variable reset that only lands after those years may affect you less.',
          calculatorLead:
            'Once you have a candidate mix, the way to test it is to build it and read the numbers. The calculator takes up to three tracks and shows the first and highest monthly payment and the total cost, and lets you check a mix where rates rise:',
          calculatorLink: 'Go to the mortgage calculator',
        },
        disclaimer:
          'This information is general, does not depend on your calculation, and is not advice or an offer. Mortgage terms are set by the loan agreement and by Bank of Israel rules.',
        backToArticles: 'Back to all articles',
      },
      mortgageDecisions: {
        intro:
          'Once the track types are clear, three questions are where the real decisions happen: which ready-made mix to start from, which track to send prepayment money to, and which amortization schedule to run the loan on. This article walks through all three, and each mix links straight into the calculator where you can try it.',
        presets: {
          title: 'The four ready-made mixes in the calculator',
          lead: 'The calculator offers four ready-made mixes, and one button fills the tracks with each split. They are not a personal recommendation, they are starting points that demonstrate the risk scale: the larger the fixed share, the more predictable the payment and usually the higher the rate; the larger the prime and variable share, the lower the average historical cost, but the payment is exposed to rate moves and the indexed part of the debt grows with the index.',
          blocks: {
            basket1: {
              title: 'Mix 1: all fixed',
              text: 'A single fixed non-indexed track carrying 100% of the loan. Maximum predictability: the payment is known up front for the whole term and depends on neither the Bank of Israel rate nor inflation. The price: a higher opening rate than the variable tracks, and no prepayment-penalty exemption.',
            },
            basket2: {
              title: 'Mix 2: half fixed, half prime',
              text: 'Two tracks: 50% fixed non-indexed and 50% prime. Half the payment is locked for the whole term, and half moves with the Bank of Israel rate, up or down. Prime is exempt from the prepayment penalty, so there is always a flexible exit from half the loan.',
            },
            basket3: {
              title: 'Mix 3: three equal thirds',
              text: 'Three equal tracks: about 33% fixed non-indexed, about 33% prime, and about 33% variable indexed every 5 years. Adding the indexed track lowers the rate but introduces a new risk: that part of the debt grows with the Consumer Price Index, beyond the interest. Its rate reset date is also a penalty-free exit point.',
            },
            basket4: {
              title: 'Recommended mix: 40% prime, 34% fixed, 26% variable indexed',
              text: 'The blended composition of three tracks: 40% prime, 34% fixed non-indexed and 26% variable indexed every 5 years. The variable part (prime plus the indexed track) is larger than in mix 3, so the average cost is lower and the exposure to rate moves and inflation is higher. The calculator labels it the recommended mix, but here recommended means a common starting point, not a personal fit.',
            },
          },
          tryLabel: 'Try this mix in the calculator',
        },
        prepay: {
          title: 'Prepayment: which track to pay off first',
          lead: 'When you divert money to an early repayment, its return is the rate of the track being shrunk, and it is guaranteed: there is no safer gain than not paying interest you would otherwise pay. That yields a simple rule of thumb, with one important exception.',
          facts: {
            rateFirst: {
              title: 'The core rule: prepay the highest-rate track first',
              text: 'Every shekel prepaid saves the interest that would have accrued on it until the end of the term, so one shekel sent to a 6% track saves more than a shekel sent to a 3% track. This is a guaranteed return, not an estimated one, which is why it beats comparing against investments whose future return is unknown.',
            },
            penalty: {
              title: 'The exception: a prepayment penalty can tip the scales',
              text: 'A fixed-rate track may carry a discounting penalty if market rates have fallen below the rate locked in the agreement, while prime is always exempt and a variable track is exempt at its rate reset date. If the highest-rate track carries a significant penalty and a lower-rate penalty-free track exists, the decision is no longer automatic: subtract the penalty from the expected saving and compare the tracks.',
            },
          },
          ruleNote:
            'This is a rule of thumb, not personalized advice: the penalty is set by the loan agreement, and before a large prepayment it is worth asking the bank for the figures in writing. The full mechanism and the discounts are covered in the article:',
          prepaymentLink: 'Mortgage prepayment penalties',
        },
        methods: {
          title: 'Spitzer versus equal principal: a borrower decision, not a track decision',
          framing:
            'A common mistake is to think of the amortization schedule as a choice that fits "a specific track". The schedule defines the repayment structure of the whole loan: how every payment splits between principal and interest over the years. The meaningful decision is therefore the borrower\'s cash-flow situation, not a strategy of one schedule here and another there.',
          spitzer:
            "Spitzer (the standard schedule): the monthly payment stays constant for the whole track term (as long as the track's own rate does not reset), which makes budgeting easy. The price: in the early years most of the payment is interest, and the total interest over the life of the loan is higher.",
          equalPrincipal:
            'Equal principal: the payment starts noticeably higher and declines over the years, because the principal shrinks faster. At the same rate and term the total interest is lower. It suits someone who can afford a high payment today and prefers to cut the total cost even at the price of a demanding budget in the first years.',
          availability:
            'A note most guides skip: most Israeli banks do not offer equal principal at all. It is mainly associated with Bank Leumi and Mizrahi-Tefahot, so before building a plan around it, confirm with the specific bank that it is even available.',
          calculatorNote:
            'The calculator lets you set the amortization schedule per track, which makes it easy to compare both methods on the same numbers, but when it comes to the real decision it is worth choosing one consistent schedule for the whole loan. For the basics of the track types themselves, we wrote here:',
          trackTypesLink: 'Mortgage track types',
        },
        disclaimer:
          'This information is general, does not depend on your calculation, and is not advice or an offer. Mortgage terms, rates and fees are set by the loan agreement and by Bank of Israel rules.',
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
        tooMany: 'Too many messages were sent. Please try again later',
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
      approvalDateLabel: 'Pre-approval date',
      rateValidity: {
        valid: 'Rate valid until {{date}}',
        expiring: 'Rate expires soon, on {{date}}',
        expired: 'Rate validity ended on {{date}}',
      },
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
        marginLabel: 'Market margin',
        methodLabel: 'Amortization',
        methodSpitzer: 'Spitzer',
        methodEqualPrincipal: 'Equal principal',
      },
      help: {
        readMore: 'Read more',
        trackTypeAria: 'More about the track types',
        trackTypes: {
          // Each body opens with the track's own select label (the test below
          // guards it), so the tip reads "<name> is..." and never forces the
          // reader to match the tip back to the select.
          prime:
            'Prime is the Bank of Israel rate plus a fixed margin. It moves with every rate decision, and you can leave the track at any time without a penalty.',
          fixed:
            'Fixed non-indexed locks the rate and payment for the whole term. That certainty starts at a higher rate, and there is no penalty-free exit.',
          variable5y:
            'Variable every 5 years non-indexed is a bank-set reference rate that updates every 5 years and acts like a fixed rate in between. Each update is a penalty-free exit point.',
          variable:
            'Variable yearly non-indexed is a bank-set reference rate that updates yearly and acts like a fixed rate in between. Each update is a penalty-free exit point.',
          fixedIndexed:
            'Fixed CPI-indexed locks the rate for the whole term and indexes the debt to CPI: inflation grows the principal itself, not just the payment.',
          variableIndexed5y:
            'Variable indexed every 5 years combines a rate that updates every 5 years with CPI indexation: inflation grows the principal while the rate updates every 5 years.',
          variableIndexed:
            'Variable indexed yearly combines a yearly-updated rate with CPI indexation: inflation grows the principal while the rate updates yearly.',
        },
        methodAria: 'More about the amortization schedule',
        method:
          'Spitzer keeps the payment constant; equal principal starts higher, declines over time and saves on total interest. This is a whole-loan decision based on your cash flow, not a separate choice per track.',
        termAria: 'More about the mortgage term',
        term: 'The slider sets the term for all tracks at once, and each track can still be adjusted in its own years field. A longer term lowers the monthly payment but raises the total interest.',
        presetAria: 'More about the ready-made mixes',
        preset:
          'A ready-made mix fills the tracks with a fixed split between fixed, prime and variable-indexed tracks, as a starting point to tweak. The article explains what each mix contains.',
        approvalDateAria: 'More about how long a pre-approval rate holds',
        approvalDate:
          'Per the Bank of Israel, a rate in a pre-approval holds for 24 days from issue. The date is saved with the mix and drives the rate-validity calculation.',
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
        highestPaymentDefault: 'Highest estimated monthly payment',
        highestCaption: 'Largest payment across the whole term, per indexation',
        highestCaptionWithYear: 'The payment reaches its peak in year {{year}}',
        totalInterestCard: 'Total interest',
        interestCaption: 'Extra cost of borrowing beyond the principal',
        totalPaymentCaption: 'Everything repaid: principal plus interest',
        totalPaymentCaptionIndexed: 'Everything repaid: principal, indexation and interest',
        totalForYearsPrefix: 'Total payments over ',
        totalForYearsSuffix: ' years',
        totalOneYear: 'Total payments for one year',
        defaultPaymentNote: 'Assuming a fixed rate for the entire term',
        overpayCard: 'Total cost of credit',
        overpayCaption: 'How much extra you repay on top of the principal',
        avgPaymentCard: 'Average payment',
        avgPaymentCaption: 'Total cost divided evenly across every month of the term',
        firstPaymentNote: 'First monthly payment: {{payment}}',
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
        principalDeclineCard: 'Total principal repaid',
        principalDeclineCaption: 'The principal paid back over the whole term',
        principalDeclineCaptionIndexed:
          'The principal repaid plus {{indexation}} of indexation',
        marketMarginLine: 'Market margin: {{percent}}%',
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
          totalInterest:
            'The total amount you pay the bank beyond the principal ~ the interest accrued on the loan over the whole term. Higher rates or longer terms mean more total interest. To reduce it: raise your down payment, shorten the term, or get a better rate.',
          totalPayment:
            'All payments over the life of the mortgage ~ principal and interest combined. This is the number that matters when comparing offers: a low monthly payment over a long term can still add up to a higher total cost.',
          rateUp:
            'What would happen to your first monthly payment if every variable-rate track rose by 1%. It is a stress mix showing how sensitive your payment is to rate increases. Fixed-rate tracks are unaffected.',
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
          principalDecline:
            'The total principal your payments give back over the term. On an indexed track, indexation makes the debt grow every month, so this sum is larger than the original loan ~ the difference is the indexation. On a non-indexed track it is exactly the loan amount.',
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
            label: 'Average rates on new mortgages',
            url: '/rates',
          },
          cpi: {
            label: 'Consumer Price Index - Israel Central Bureau of Statistics',
            url: 'https://www.cbs.gov.il/en/subjects/Pages/consumer-price-index.aspx',
          },
        },
      },
      charts: {
        amortAria: 'Amortization chart: principal and interest per period with the loan balance',
        mixAria: 'Track-mix donut chart',
        netPrincipalLabel: 'Net principal',
        costAria: 'Principal, indexation and interest over the full term',
        perTrackAria: 'Per-track balance comparison over the term',
        mixTotalLabel: 'Total mortgage',
        costCenterLabel: 'interest',
        costSliceLine: '{{label}}: {{amount}}, {{percent}}%',
        costTotalLine: 'Total repayments: {{amount}}',
        yearLabel: 'Year {{year}}',
        monthLabel: 'Month {{month}}',
        axisPayment: 'Annual payment',
        axisMonthlyPayment: 'Monthly payment',
        axisBalance: 'Balance',
        axisYear: 'Year',
      },
      prepayment: {
        heading: 'Early-repayment fee',
        lead:
          'An estimate of the discounting fee the bank would charge to repay the mortgage on the date you pick, track by track, using the Bank of Israel formula. Every figure comes from the amortization schedule above.',
        prepayYearsLabel: 'Repayment date (years from the mortgage)',
        yearsSuffix: 'years',
        yearsHint: 'Year 1 to {{max}} - the last year with a balance',
        marketRateLabel: 'Annual comparison rate',
        marketRatePlaceholder: 'From the BOI table',
        marketRateManual: 'Your own rate, for every track',
        marketRateSuggestedNote: 'Suggested comparison rate from the latest BOI table: {{rate}}.',
        partialLabel: 'Partial prepayment amount',
        exitStation: 'Repaid at an exit station (rate-reset date)',
        table: {
          track: 'Track',
          balance: 'Outstanding principal',
          marketRate: 'Comparison rate',
          fee: 'Discounting fee',
          rateAddition: 'Rate addition for comparison',
        },
        totalLabel: 'Total discounting fee',
        stats: {
          total: 'Total discounting fee',
          balance: 'Balance to repay',
          share: 'Fee of the balance',
        },
        discount: {
          title: 'The loyalty discount at this date',
          gross: 'Fee before the discount',
          amount: 'Loyalty discount ({{percent}}%)',
          after: 'Discounting fee after the discount',
          hint: 'The reduction follows the age of the loan: 20% from year 3, 30% from year 5.',
        },
        extras: {
          title: 'Fees charged on top of the discounting fee',
          lead: 'The discounting fee is the statutory core. These are the other components the bank may charge on the same prepayment. The handling fee and the no-notice rate are caps, so the bank may charge less.',
          operational: 'Handling fee, up to {{cap}} per track',
          operationalHint: 'Charged once for each track being repaid.',
          noNotice: 'No-notice fee (0.1%)',
          noNoticeHint: 'When the request is made less than 10 days before the repayment.',
          cpi: 'CPI compensation',
          cpiHint: 'On the indexed part, when the repayment falls on days 1-15 of the month.',
          total: 'Fee including these charges',
          note: 'These are upper bounds, not a quote: the bank sets the actual amounts. The CPI part uses the calculator’s own inflation assumption.',
        },
        rateAdditionTiny: '<0.01%',
        noFeeAtMarket:
          'At the current comparison rate no track carries a discounting fee. Enter a lower rate to see what a fee would look like.',
        mixLine_one: 'The mix being priced: 1 track, {{balance}} to repay',
        mixLine_two: 'The mix being priced: 2 tracks, {{balance}} to repay',
        mixLine_other: 'The mix being priced: {{count}} tracks, {{balance}} to repay',
        orderFirst: 'Repay first',
        orderPerThousand: 'Fee per ₪1,000: {{amount}}',
        orderAllocateAria: 'Amount to repay from the {{track}} track',
        orderNoAmount:
          'Enter a partial amount above, or fill in one track or several. With no amount there is no partial prepayment, and the list shows only the ranking.',
        zeroWhy:
          'Why 0? Prime and annually reset tracks are always exempt. A five-year track is exempt on its reset date, and when the comparison rate is not below the track rate there is no fee to pay.',
        noFee: 'No fee',
        noFeeWhy:
          'The comparison rate is not below this track’s rate, so early repayment carries no discounting fee here.',
        capped: 'Capped',
        chartTitle: 'Discounting fee by repayment date',
        chartLead:
          'Later in the schedule the balance is smaller and the fee falls; each rate reset of a five-year variable track steps it down. An exempt track stays on zero all the way.',
        chartNearZero:
          'The chart sits almost flat on zero because the comparison rate ({{rate}}%) is close to the tracks’ own rates: a discounting fee arises only when the market rate falls below the loan’s rate. Lower the comparison rate to see that scenario.',
        chartCaption: 'Click the chart to pick a repayment date',
        chartAria: 'Discounting fee per track by repayment year',
        chartAxisFee: 'Discounting fee',
        chartTableSummary: 'Show the data as a table',
        chartTableAria: 'Discounting fee per track by repayment year',
        chartTableYear: 'Year',
        orderTitle: 'Cheapest payoff order: how much from each track',
        orderLead:
          'The total above spreads from the cheapest track to the dearest. Editing a row moves money between tracks without changing the total, and one click fills any remainder.',
        orderAmount: 'Amount',
        orderFee: 'Fee',
        orderTotalLabel: 'Total prepayment',
        orderRemaining: 'Still unallocated from the total: {{amount}}',
        orderFillRemaining: 'Fill the remainder cheapest first',
        exempt: {
          prime: 'Exempt (prime)',
          frequentReset: 'Exempt (annual rate reset)',
          exitStation: 'Exempt (exit station)',
        },
        marketRateSource:
          'The comparison rate comes from the Bank of Israel average-rate table for {{date}} and is converted to a monthly rate on an effective annual basis.',
        marketRateFallback: 'The Bank of Israel average rate could not be loaded, so the estimate uses {{rate}}%.',
        marketRateLink: 'The average-rate table',
        capTitle: 'Origination-rate cap (section 3(4))',
        capLead:
          'If you know the Bank of Israel average rate for the track type and term on the day the loan was taken, enter it for that track. The cap replaces the calculation only when that average is below the track rate.',
        capExempt:
          'Exempt tracks are not shown here: {{tracks}}. Their fee is zero whatever the origination average was, so an input there would have nothing to change.',
        capRateLabel: 'Origination average rate',
        capRatePlaceholder: 'Not known',
        capStatusActive: 'Cap applied: this track’s fee is {{fee}}',
        capStatusIdle: 'No effect: the cap is not below the track’s rate',
        capNote:
          'With no value the cap is not applied, so the fee may be higher than the one actually charged, never lower. Exempt tracks are not listed here because their fee is zero either way.',
        note: 'The estimate is for the date you choose, using the Bank of Israel formula. It covers the discounting (היוון) component only: an operational fee, a no-notice fee (up to 0.1% of the amount repaid) and a CPI compensation fee on index-linked tracks are charged on top. The section 3(4) cap applies only when you enter the average rate on the origination date; with no value it is left off, so the estimate may be higher than the actual fee. Your bank decides the actual fee.',
        emptyTitle: 'Nothing left to repay on that date',
        empty:
          'By year {{years}} no track still carries a balance: the mortgage ends before that, and the last date with something to repay is year {{last}}.',
        emptyAction: 'Set the date to year {{years}}',
        emptyMix: 'Add a track to the mortgage to estimate the early-repayment fee.',
        outcomes: {
          title: 'What the amount does',
          lead:
            'The amount is spread across the tracks in proportion to their balances. One way finishes earlier; the other keeps the end date and lowers the monthly payment.',
          shortenTitle: 'Finish earlier',
          shortenPayment: 'Payment after: {{amount}}',
          shortenTerm: 'Term: {{from}} to {{to}}',
          lowerTitle: 'Lower the payment',
          lowerPayment: 'Payment after: {{amount}}',
          lowerWas: 'Instead of {{amount}}',
          lowerTerm: 'Term stays {{term}}',
          interestLeft: 'Interest left: {{amount}}',
          note: 'The fee above is not included. The model continues at the current rate and the calculator’s CPI assumption; actual rate resets and index changes will move the result.',
          termYear: '1 year',
          termYears: '{{years}} years',
          termMonth: '1 month',
          termMonths: '{{months}} months',
          termJoin: ', ',
          termNow: 'now',
        },
      },
      forecast: {
        heading: 'Rate and CPI forecast',
        resetHeading: 'Monthly payment by rate scenario',
        resetLead: 'The monthly payment at the start of each year; vertical lines mark the resets.',
        resetYears: 'Rate resets in years {{years}}',
        costCaption: 'Indexation is shown at a flat {{cpi}}% CPI a year',
        noReset:
          'No rate reset falls inside the loan term, so all scenarios are identical. Only five-year variable tracks have a contractual reset date.',
        costHeading: 'Cumulative interest and indexation',
        costLead: 'What has accrued from the start of the loan through the end of each year on the base rate path.',
        noIndexation:
          'The mix has no CPI-indexed track, so there is no indexation to show. The line shows cumulative interest only.',
        tableYear: 'Year',
        tableInterest: 'Cumulative interest',
        tableIndexation: 'Cumulative indexation',
        resetTableAria: 'Monthly payment by year and rate scenario',
        costTableAria: 'Cumulative interest and indexation by year',
        scenarios: {
          base: 'No change',
          up: '+{{step}} pp',
          down: '-{{step}} pp',
        },
        series: {
          interest: 'Cumulative interest',
          indexation: 'Cumulative indexation',
        },
        yearLabel: 'Year {{year}}',
        axisPayment: 'Monthly payment',
        axisCumulative: 'Cumulative amount',
        chartResetAria: 'Monthly payment by rate scenario, with reset dates marked',
        chartCostAria: 'Cumulative interest and indexation over the term',
        disclaimer:
          'The forecast is an illustration only, not a forecast of rates or the CPI. Assumptions: at every reset of a five-year variable track the rate moves by ±{{step}} percentage point (pp) in each scenario, and the CPI rises at a flat {{cpi}}% a year. The actual rate, reset dates and CPI may differ, and the monthly payment is recalculated at every reset. It is not financial advice.',
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
        duplicateType:
          'A track type cannot repeat within one mix. Pick a different type for one of the marked tracks.',
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
        rateExpiring:
          'The pre-approval rate is about to lapse (until {{date}}). Consider asking the bank for an updated approval.',
        rateExpired:
          'The pre-approval rate has lapsed ({{date}}). Ask the bank for an updated rate.',
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
        monthPaymentHeader: 'Monthly payment',
        yearHeader: 'Year',
        paymentHeader: 'Payment',
        principalHeader: 'Principal',
        indexationHeader: 'Indexation',
        interestHeader: 'Interest',
        annualPaymentHeader: 'Annual payment',
        balanceHeader: 'Balance',
        asideTitle: 'First annual payment',
        asideCaption: 'Sum of payments in the first 12 months',
        paybackHeader: 'Payback ratio',
        paybackRatioLabel: 'Payback ratio',
        trackTableAria: 'Payment schedule · {{track}}',
        expandToYears: 'Show breakdown for {{years}} years',
        collapseToFifteen: 'Show first 15 years',
      },
    },
    compare: {
      metaTitle: 'Mortgage comparison | Makeyev Finance',
      heading: 'Mortgage mix comparison',
      backToCalculator: 'Back to the mortgage calculator',
      openFromCalculator: 'Compare mixes',
      // Shared inputs (describing the buyer and the property, entered once).
      sharedInputsHeading: 'Mortgage mixes',
      purposeLabel: 'Purpose of purchase',
      propertyValueLabel: 'Property value',
      capitalLabel: 'Initial capital',
      incomeLabel: 'Net monthly income',
      // Scenario column/section headers, under the user-facing name "mix"
      // (the same word the Hebrew side uses: תמהיל). The key names and the
      // code stay on the English word "scenario".
      scenarioLabelAria: 'Mix name',
      scenarioUntitle: 'Mix {{index}}',
      scenarioRemove: 'Remove mix',
      scenarioDuplicate: 'Duplicate mix',
      scenarioAdd: 'Add mix +',
      scenarioTermLabel: 'Term',
      scenarioTermSuffix: 'years',
      trackAdd: 'Add track +',
      trackLegend: 'Track {{index}}',
      trackRemoveAria: 'Remove track',
      trackAmountLabel: 'Amount',
      trackRateLabel: 'Rate',
      trackTypeLabel: 'Track type',
      trackMethodLabel: 'Amortization',
      // Comparison table: metric rows (vocabulary mirrors calculator.results).
      metricAvgPayment: 'Average monthly payment',
      metricRecommendedIncome: 'Recommended net income',
      metricTotalPayment: 'Total payments over {{years}} years',
      metricTotalPaymentGeneric: 'Total payments',
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
      statusErrorDuplicateType: 'The same track type appears more than once in this mix',
      // Mobile stacked view.
      scenarioSwitcherAria: 'Switch between mixes',
      bestBadge: 'Best',
      chartsHeading: 'Payments over time',
      mixDonutTitle: 'Track mix composition',
      paymentTrendTitle: 'Monthly payment over time',
      paymentCompositionTitle: 'Monthly payment composition: principal, indexation and interest',
      totalPaymentsTitle: 'Total payments accumulated',
      remainingBalanceTitle: 'Remaining balance over time',
      cumulativeInterestTitle: 'Cumulative interest over time',
      cumulativeIndexationTitle: 'Cumulative indexation over time',
      prepaymentFeeTitle: 'Early-repayment fee over time',
      chartAria: '{{mode}} chart by year',
      chartsEmpty: 'Add tracks to see charts',
      trendLegendAria: 'Mixes',
      trendSeriesLine: '{{label}}: from {{from}} to {{to}}',
      axisTotalPaid: 'Total paid',
      axisCumulativeInterest: 'Cumulative interest',
      axisCumulativeIndexation: 'Cumulative indexation',
      axisPrepaymentFee: 'Discounting fee',
      rateScenariosTitle: 'Monthly payment by rate scenario',
      rateScenariosAria:
        'Monthly payment by rate scenario for every mix, with a shaded scenario range and reset dates marked',
      rateScenarioRange: 'Range: ±{{step}} pp',
      rateResetListAria: 'Rate reset years by mix',
      rateMixResetYears: 'Rate resets: {{years}}',
      rateMixNoReset: 'No rate reset',
      rateScenarioPartialNote:
        'The range is shown only for mixes with a five-year variable track. A mix without one stays a single line, even if it is CPI-indexed.',
      rateScenarioNoResetNote:
        'No rate reset falls inside the term, so every scenario is identical and each mix draws a single line.',
      rateSeriesLabel: '{{mix}}: {{scenario}}',
      rateTableAria: 'Monthly payment by year and rate scenario for {{mix}}',
      scheduleTitle: 'Payments schedule',
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
      // Hover-tooltip copy for each index row (see IndexesBar's FeedAnchor):
      // what the index measures, then (below) how it reaches a mortgage.
      descriptions: {
        cpi: 'The consumer price index tracks how the prices households pay for a basket of goods and services change',
        residentialConstruction:
          'The residential construction input index tracks the cost of materials and labour for residential building',
        commercialConstruction:
          'The commercial and office construction input index tracks input costs for that sector',
      },
      // The tooltip's second clause: how each index reaches a mortgage or loan.
      mortgageEffects: {
        cpi: 'CPI is the index used to link mortgage tracks to inflation, so its rise grows the linked balance and the monthly payment',
        residentialConstruction: 'It drives the cost of building a new home, so it feeds new-build prices rather than a mortgage payment',
        commercialConstruction: 'It drives building costs for commercial and office property rather than a mortgage payment',
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
    rates: {
      title: 'Average rates',
      subtitle: 'Average mortgage rates',
      intro:
        'The Bank of Israel publishes a monthly effective average rate on new housing loans, by period to repayment. The tables show the official data, including the last 12 months.',
      indexedTitle: 'CPI-indexed mortgages',
      nonIndexedTitle: 'Non-indexed mortgages',
      indexedNote: 'Effective rates on new CPI-indexed housing loans, by period to repayment.',
      nonIndexedNote:
        'Effective rates on new loans in the non-indexed shekel sector, by period to repayment.',
      current: 'Current rate',
      currentBadge: 'Latest',
      validFrom: 'Rate valid from {{date}}',
      historyTitle: 'Monthly history',
      historyCaption: 'The last 12 months. The first row is the current rate.',
      historyHint: 'Scroll the table sideways',
      month: 'Valid from',
      average: 'Average',
      loading: 'Loading Bank of Israel data...',
      errorTitle: 'Could not load the average rates',
      errorBody: 'Try again, or open the official table on the Bank of Israel site.',
      retry: 'Try again',
      retrying: 'Retrying...',
      empty: 'No data was published for this period.',
      unavailable: 'The data is not available right now. Try again later.',
      stale: 'Showing the last data we had, which could not be refreshed. It may be out of date.',
      source: 'Source: Bank of Israel',
      sourceLink: 'The official table on the Bank of Israel site',
      sourceUrl: 'https://www.boi.org.il/en/information/interestrates/mortgage/',
      buckets: {
        over25: 'More than 25 years',
        '20to25': '20-25 years',
        '15to20': '15-20 years',
        '10to15': '10-15 years',
        '5to10': '5-10 years',
        '1to5': '1-5 years',
        upTo5: 'Up to 5 years',
        upTo1: 'Up to 1 year',
      },
      footnotes: {
        periods: 'Periods include their upper bound.',
        upTo1:
          'The "up to 1 year" period also includes loans whose rate-reset date is not known in advance.',
        source:
          'These are the effective average rates the Bank of Israel publishes for early-repayment-fee calculations. They are not an offer or a bank commitment.',
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
    comments: {
      title: 'Comments',
      empty: 'No comments yet. Be the first to write one.',
      loading: 'Loading comments...',
      loadError: 'Loading the comments failed. Please try again.',
      signInPrompt: 'Sign in to comment',
      placeholder: 'Write a comment...',
      submit: 'Post comment',
      reply: 'Reply',
      replyTo: 'Replying to {{name}}',
      cancel: 'Cancel',
      edit: 'Edit',
      saveEdit: 'Save changes',
      edited: 'edited',
      // A comment whose author's account has since been deleted keeps the name
      // it was posted under and gains this beside it (the parentheses are added
      // in the markup, like the "edited" marker).
      deletedAuthor: 'deleted account',
      deleted: 'This comment was removed',
      delete: 'Delete',
      deleteConfirmTitle: 'Delete comment',
      deleteConfirmBody: 'The comment will be removed. Its replies will stay.',
      deleteFailed: 'Deleting failed. Please try again.',
      deletedToast: 'Comment deleted',
      showMore: 'Show more comments',
      showMoreReplies_one: 'Show 1 more reply',
      // English has no "two" plural category, so this duplicates _other; the key
      // exists because both language files must carry the same set (Hebrew is
      // the one that actually selects it).
      showMoreReplies_two: 'Show {{count}} more replies',
      showMoreReplies_other: 'Show {{count}} more replies',
      collapseReplies: 'Collapse replies',
      expandReplies: 'Expand replies',
      blocked: 'Your comment contains language that is not allowed, so it was not posted.',
      rateLimited: 'Too many comments. Please try again in a minute.',
      genericError: 'Posting failed. Please try again.',
    },
    replies: {
      title: 'Replies to you',
      empty: 'No replies to your comments yet.',
      loadError: 'Loading the replies failed. Please try again.',
      // Same rule as the article thread: a reply from an account that has since
      // been deleted keeps its name and says so.
      deletedAuthor: 'deleted account',
      view: 'View in the article',
    },
    savedMixes: {
      saveAction: 'Save this mix',
      saving: 'Saving...',
      saveTitle: 'Save this mix',
      labelLabel: 'Name',
      labelPlaceholder: 'e.g. First home mix',
      defaultLabel: 'Mix',
      confirm: 'Save',
      cancel: 'Cancel',
      signIn: 'Sign in to save',
      saved: 'Mix saved',
      saveError: 'Saving failed. Please try again.',
      capReached: 'You can save up to 4 mixes. Remove one to add another.',
      profileTitle: 'My saved mixes',
      empty: 'You have not saved any mixes yet.',
      loading: 'Loading...',
      loadError: 'Loading your mixes failed. Please try again.',
      load: 'Load in calculator',
      myMixesLink: 'My mixes',
      delete: 'Delete',
      deleteConfirmTitle: 'Delete mix',
      deleteConfirmBody: 'This mix will be deleted permanently.',
      deleteError: 'Deleting failed. Please try again.',
      total: 'Mortgage amount',
      monthlyPayment: 'Monthly payment',
      propertyPrice: 'Property price',
      capital: 'Equity',
      income: 'Net monthly income',
      purpose: 'Purpose',
      termFor_one: 'For a term of 1 year',
      termFor_two: 'For a term of 2 years',
      termFor_other: 'For a term of {{count}} years',
      unsavedTitle: 'Unsaved changes',
      unsavedBody: 'This mix is not saved. It stays in this browser until you refresh or close it. Leave anyway?',
      unsavedLeave: 'Leave anyway',
      unsavedStay: 'Stay',
      savedState: 'Saved',
      unsavedSave: 'Save',
      editingMix: 'Editing mix',
      newMix: 'New mix',
      newMixConfirmTitle: 'Start a new mix',
      newMixConfirmBody:
        'Your current mix has unsaved changes. Starting a new mix clears the calculator and stops editing the loaded mix.',
      newMixConfirmAction: 'Start new mix',
      duplicateName: 'You already have a mix with this name. Choose a different name.',
      noSavedMixes: 'No saved mixes yet',
      loadOtherMixTitle: 'Load another mix?',
      loadOtherMixBody:
        'The current mix has unsaved changes. Loading another mix will discard them.',
      loadOtherMixAction: 'Load mix',
    },
    auth: {
      account: 'Account',
      loginLink: 'Sign in',
      signOut: 'Sign out',
      profileItem: 'Profile',
      pageTitle: 'Sign in or register',
      tabSignIn: 'Sign in',
      tabSignUp: 'Register',
      emailLabel: 'Email address',
      passwordLabel: 'Password',
      confirmPasswordLabel: 'Confirm password',
      passwordMismatch: 'The passwords do not match',
      nameLabel: 'Full name',
      signInAction: 'Sign in',
      signUpAction: 'Create account',
      submitting: 'Sending...',
      showPassword: 'Show password',
      hidePassword: 'Hide password',
      errorInvalidCredentials: 'Wrong email address or password',
      errorEmailInUse: 'That email address is already registered',
      errorPasswordLength: 'The password must be at least 8 characters',
      errorGeneric: 'Something went wrong. Please try again',
      errorAccountNotLinked:
        'This address is already registered with a password that was not verified. Verify it, then sign in with Google',
      errorSocialFailed: 'Google sign-in failed. Please try again',
      errorSocialExpired: 'The sign-in attempt expired or was blocked. Please try again',
      errorSocialLinkStuck:
        'This Google account is linked to an account that no longer exists. Contact us to release the link',
      errorDeleteSignInRequired:
        'Sign in first to finish deleting the account, then open the link in the message again',
      verifyRequired: 'Verify your email address before signing in',
      // The panel never claims the account exists before the address is
      // verified. It states only that the mail went out, and the sentence leads
      // into the masked address shown as a chip beneath it (user-requested).
      verifyTitle: 'The verification email has been sent to',
      resend: 'Resend the verification email',
      resendSent: 'We sent another verification email',
      backToSignIn: 'Back to sign in',
      forgotPassword: 'Forgot password?',
      resetTitle: 'Reset your password',
      resetRequestHint: 'We will email you a 4-digit code to reset your password',
      resetRequestAction: 'Send the code',
      resetSent: 'We sent a 4-digit code to this address:',
      resetCodeLabel: '4-digit code',
      resetCodeHint: 'The code expires 5 minutes after it is sent',
      resetNewPasswordLabel: 'New password',
      resetAction: 'Reset password',
      resetVerifyAction: 'Verify code',
      resetResend: 'Send a new code',
      resetResendSent: 'We sent a new code. The previous one is no longer valid',
      resetResendIn: 'Send a new code in {{seconds}}s',
      resetResendExhausted: 'Three codes were sent. If none arrived, request a new code from the sign-in form',
      resetDone: 'Your password has been updated. You can now sign in with the new password',
      resetInvalidCode: 'The code is wrong or has expired',
      resetTooManyAttempts: 'Too many attempts. Request a new code and try again',
      otpErrorTooManyRequests: 'Too many requests. Please wait a minute and try again',
      socialGoogle: 'Google',
      orEmail: 'or sign in with email',
      signedInAs: 'Signed in as {{email}}',
      advisorTitle: 'Advisor area',
      advisorBody: 'This page is available to advisors and admins only',
      clientTitle: 'Client area',
      clientBody: 'This page is available to signed-in users only',
      profileTitle: 'Profile',
      profileRoleLabel: 'Account type',
      roleClient: 'Client',
      roleAdvisor: 'Advisor',
      roleAdmin: 'Admin',
      profileAccountTitle: 'Account',
      profileChangePasswordTitle: 'Change password',
      profileCurrentPasswordLabel: 'Current password',
      profileRevokeOtherSessions: 'Sign out of all other devices',
      profileChangePasswordAction: 'Update password',
      profilePasswordChanged: 'Your password has been updated',
      profileErrorInvalidPassword: 'The current password is wrong',
      profileSignOutAll: 'Sign out of all devices',
      // An account created through Google has no password at all, so the same
      // button and modal set a first one instead of changing it.
      profileSetPasswordTitle: 'Set a password',
      profileSetPasswordHint:
        'This account has no password, it signs in with Google. Once a password is set you can sign in with email and password too',
      profileSetPasswordAction: 'Save the password',
      profileSetPasswordDone: 'Password set. You can now sign in with email and password too',
      profileSetPasswordHasPassword:
        'This account already has a password. Use change password instead',
      profileSetPasswordTooManyAttempts: 'Too many attempts. Please wait a minute and try again',
      profileDeleteAccount: 'Delete account',
      profileDeleteTitle: 'Delete account',
      profileDeleteWarning:
        'The account will be deleted permanently, including your saved mixes. Comments you already wrote stay on the articles, shown under the name you posted with and marked "(deleted account)". The account cannot be restored',
      profileDeleteConfirmLabel: 'To confirm, type {{word}}',
      profileDeleteConfirmWord: 'DELETE',
      profileDeleteConfirmMismatch: 'The word you typed does not match',
      // The password the account proves itself with. Better Auth checks it
      // before the deletion code is mailed, so a typo is answered rather than
      // ignored.
      profileDeletePasswordHint: 'The password is checked before the deletion code is sent',
      profileDeletePasswordRequired: 'Enter your password',
      // The first button mails the code; the account goes when that code is
      // typed into the modal's second step.
      profileDeleteSendCode: 'Send a code',
      profileDeleteAction: 'Delete',
      profileDeleting: 'Deleting...',
      profileDeleteSessionExpired: 'This action needs a fresh sign-in. Sign in again and retry',
      // The second step: the mailed code is the last thing between the account
      // and its deletion.
      profileDeleteCodeTitle: 'Enter the deletion code',
      profileDeleteCodeSentTo: 'We sent a deletion code to',
      profileDeleteCodeLabel: 'Deletion code',
      profileDeleteCodeHint: 'The code has letters and numbers, and is valid for 30 minutes',
      profileDeleteInvalidCode: 'The code is wrong or has expired',
      profileDeleteResendCode: 'Send a new code',
      profileDeleteResendSent: 'A new code was sent',
      profileDeleteTooManyAttempts: 'Too many requests. Please wait a minute and try again',
      emails: {
        subject: 'Verify your email address',
        heading: 'Verify your email address',
        greetingPrefix: 'Hello',
        greetingGeneric: 'Hello,',
        body: 'To finish creating your account, please verify your email address',
        cta: 'Verify email',
        ignore: 'If you did not request this account, you can ignore this message',
        otpSubject: 'Your password reset code',
        otpHeading: 'Reset your password',
        otpBody: 'Enter this code in the password reset form:',
        otpExpiry: 'The code is valid for 5 minutes',
        otpIgnore:
          'If you did not ask to reset your password, you can ignore this message. Your password stays unchanged',
        deleteSubject: 'Your account deletion code',
        deleteHeading: 'Delete your account',
        deleteBody:
          'To delete the account permanently, enter this code in the delete-account window on your profile page. The account and your saved mixes will be deleted. Comments you already wrote stay on the articles',
        deleteExpiry: 'The code is valid for 30 minutes',
        deleteIgnore:
          'If you did not ask to delete the account, you can ignore this message. The account will not be deleted',
        signature: 'Makeyev Finance',
      },
    },
  },
}
