(function () {
    const form = document.getElementById('mortgage-form')
    const tracksList = document.getElementById('tracks-list')
    const formError = document.getElementById('form-error')
    const expandScheduleButton = document.getElementById('expand-schedule')
    const resultsLayout = document.querySelector('.results-layout')
    const startingAmountInput = document.getElementById('starting-amount')
    const termYearsInput = document.getElementById('term-years')
    const propertyValueInput = document.getElementById('property-value')
    const propertyPurposeSelect = document.getElementById('property-purpose')
    const initialCapitalInput = document.getElementById('initial-capital')
    const monthlyIncomeInput = document.getElementById('monthly-income')
    const limitsWarning = document.getElementById('limits-warning')
    const equityNote = document.getElementById('equity-note')
    const autofixButton = document.getElementById('autofix-mix')
    const currency = new Intl.NumberFormat('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: 0 })
    const maximumTracks = 3
    const maximumYears = 30
    const thumbSize = 22
    const trackNames = { 1: 'מסלול אחד', 2: 'שני מסלולים', 3: 'שלושה מסלולים' }
    const fallbackInflation = 0.02
    let selectedYears = Number(termYearsInput.value) || 30
    let scheduleExpanded = false
    let startingPointDirty = false
    
    const trackTypes = {
        prime: 'פריים',
        fixed: 'קבועה לא צמודה',
        variable5y: 'משתנה כל 5 שנים לא צמודה',
        variable: 'משתנה כל שנה לא צמודה',
        fixedIndexed: 'קבועה צמודה למדד',
        variableIndexed5y: 'משתנה צמודה כל 5 שנים',
        variableIndexed: 'משתנה צמודה כל שנה'
    }
    const variableTrackTypes = ['prime', 'variable', 'variable5y', 'variableIndexed', 'variableIndexed5y']
    
    const presets = {
        basket1: [{ type: 'fixed', share: 1, rate: 4.5 }],
        basket2: [{ type: 'fixed', share: 1 / 3, rate: 4.5 }, { type: 'prime', share: 1 / 3, rate: 5.75 }, { type: 'variableIndexed5y', share: 1 / 3, rate: 3.0 }],
        basket3: [{ type: 'fixed', share: 1 / 2, rate: 4.5 }, { type: 'prime', share: 1 / 2, rate: 5.75 }],
        basket4: [{ type: 'prime', share: 0.4, rate: 5.75 }, { type: 'fixed', share: 0.34, rate: 4.5 }, { type: 'variableIndexed5y', share: 0.26, rate: 3.0 }]
    }

    const purposeLimits = {
        first: { limit: 75, label: 'דירה ראשונה' },
        upgrade: { limit: 70, label: 'שדרוג דירה' },
        investment: { limit: 50, label: 'דירה להשקעה' }
    }

    const defaultRatesByType = {
        fixed: 4.5,
        variable5y: 4.25,
        variable: 4.3,
        fixedIndexed: 3.0,
        variableIndexed5y: 3.0,
        variableIndexed: 3.2
    }

    const boiInterestUrl = 'https://www.boi.org.il/PublicApi/GetInterest'
    const primeMargin = 1.5

    function getPrimeRate() {
        return Number.isFinite(window.mortgagePrimeRate) ? window.mortgagePrimeRate : null
    }

    function formatAmountInput(input) {
        const cursor = input.selectionStart
        const digitsBeforeCursor = input.value.slice(0, cursor).replace(/[^0-9.]/g, '').length
        let numericValue = input.value.replace(/[^0-9.]/g, '')
        if (!numericValue) {
            input.value = ''
            return
        }
        const firstDot = numericValue.indexOf('.')
        if (firstDot !== -1) numericValue = numericValue.slice(0, firstDot + 1) + numericValue.slice(firstDot + 1).replace(/\./g, '')
        const [integerPart, decimalPart] = numericValue.split('.')
        const formattedInteger = integerPart ? Number(integerPart).toLocaleString('en-US') : '0'
        input.value = decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger
        if (document.activeElement !== input || cursor === null) return
        let counted = 0
        let position = input.value.length
        for (let index = 0; index < input.value.length; index++) {
            if (/[0-9.]/.test(input.value[index])) counted++
            if (counted >= digitsBeforeCursor) {
                position = index + 1
                break
            }
        }
        input.setSelectionRange(position, position)
    }

    function getStartingAmount() {
        return Number(startingAmountInput.value.replace(/[,\s]/g, '')) || 0
    }

    function getCapital() {
        return Number(initialCapitalInput.value.replace(/[,\s]/g, '')) || 0
    }

    function getPropertyAmount() {
        return Number(propertyValueInput.value.replace(/[,\s]/g, '')) || 0
    }

    function getLoanAmount() {
        const base = getPropertyAmount() > 0 ? getPropertyAmount() : getStartingAmount()
        return Math.max(0, base - getCapital())
    }

    let derivedLoan = 0

    function syncStartingFromProperty() {
        const property = getPropertyAmount()
        if (property > 0) {
            const loan = getLoanAmount()
            derivedLoan = loan
            startingAmountInput.disabled = true
            startingAmountInput.value = loan > 0 ? loan.toLocaleString('en-US') : 'אין צורך 🥳'
        } else {
            startingAmountInput.disabled = false
            if (derivedLoan > 0) {
                const gross = Math.round(derivedLoan + getCapital())
                startingAmountInput.value = gross > 0 ? gross.toLocaleString('en-US') : ''
                derivedLoan = 0
            } else if (/\D/.test(startingAmountInput.value.replace(/[,\s]/g, ''))) {
                startingAmountInput.value = ''
            }
        }
    }

    function getTrackAmount(track) {
        return Number(track.querySelector('.track-amount').value.replace(/[₪,\s]/g, '')) || 0
    }

    function setTrackAmount(track, amount) {
        track.querySelector('.track-amount').value = amount > 0 ? Math.round(amount).toLocaleString('en-US') : ''
    }

    function scaleTrackAmounts() {
        const tracks = [...tracksList.children]
        if (!tracks.length) return
        const loanAmount = getLoanAmount()
        const currentTotal = tracks.reduce((sum, track) => sum + getTrackAmount(track), 0)
        if (!loanAmount) {
            tracks.forEach(track => {
                const amount = getTrackAmount(track)
                if (amount > 0) track.dataset.loanShare = String(amount)
                setTrackAmount(track, 0)
            })
            return
        }
        let proportions
        if (currentTotal) {
            proportions = tracks.map(track => getTrackAmount(track))
        } else {
            proportions = tracks.map(track => Number(track.dataset.loanShare) || 0)
            if (!proportions.some(share => share > 0)) return
        }
        const total = proportions.reduce((sum, share) => sum + share, 0)
        let allocated = 0
        tracks.forEach((track, index) => {
            const amount = index === tracks.length - 1
                ? loanAmount - allocated
                : Math.round(loanAmount * proportions[index] / total)
            setTrackAmount(track, amount)
            allocated += amount
        })
    }

    function syncStartingAmountFromTracks() {
        if (getPropertyAmount() > 0) return
        const total = [...tracksList.children].reduce((sum, track) => sum + getTrackAmount(track), 0)
        const gross = total + getCapital()
        startingAmountInput.value = gross > 0 ? Math.round(gross).toLocaleString('en-US') : ''
    }

    function updateTermSlider() {
        selectedYears = Number(termYearsInput.value) || 30
        
        const label = document.getElementById('total-payment-label')
        const labelText = selectedYears === 1
            ? 'סך ההחזר לשנה'
            : `סך ההחזר ל-<span class="term-years-value">${selectedYears}</span> שנים`
        label.innerHTML = `<span class="total-payment-text">${labelText}</span>`
        
        const ratio = (selectedYears - 1) / (maximumYears - 1)
        const width = termYearsInput.offsetWidth || 0
        const thumbShare = width > 0 ? Math.min(1, thumbSize / width) : 0
        const start = thumbShare / 2 * 100
        const end = (1 - thumbShare / 2) * 100
        const fill = Math.min(end, Math.max(start, ((ratio * (1 - thumbShare)) + thumbShare / 2) * 100))
        termYearsInput.style.setProperty('--slider-start', `${start}%`)
        termYearsInput.style.setProperty('--slider-fill', `${fill}%`)
        termYearsInput.style.setProperty('--slider-end', `${end}%`)
    }

    function applySelectedYears() {
        tracksList.querySelectorAll('.track-years').forEach(input => {
            input.value = selectedYears
        })
    }

    function constrainTrackYears(input) {
        const digits = input.value.replace(/[^0-9]/g, '')
        if (!digits) {
            input.value = ''
            return
        }
        let years = Number(digits)
        if (years > maximumYears) years = maximumYears
        if (years < 1) years = 1
        input.value = String(years)
    }

    function syncTermSliderFromTracks() {
        const yearsValues = [...tracksList.children]
            .map(track => Number(track.querySelector('.track-years').value))
            .filter(value => Number.isFinite(value) && value >= 1)
        if (!yearsValues.length) return
        const maxYears = Math.min(maximumYears, Math.max(...yearsValues))
        if (maxYears === selectedYears) return
        selectedYears = maxYears
        termYearsInput.value = String(maxYears)
        updateTermSlider()
    }

    function snapTracksToLoan() {
        const total = [...tracksList.children].reduce((sum, track) => sum + getTrackAmount(track), 0)
        if (total) {
            scaleTrackAmounts()
            return
        }
        const count = tracksList.children.length
        const loanAmount = getLoanAmount()
        if (!count || !loanAmount) return
        const share = Math.floor(loanAmount / count)
        let allocated = 0
        ;[...tracksList.children].forEach((track, index) => {
            const amount = index === count - 1 ? loanAmount - allocated : share
            setTrackAmount(track, amount)
            allocated += amount
        })
    }

    function addTrack(values = {}) {
        const track = document.createElement('fieldset')
        track.className = 'mortgage-track'
        const displayAmount = values.amount === undefined || values.amount === '' ? '' : Number(values.amount).toLocaleString('en-US')
        const primeRate = getPrimeRate()
        let rateValue = values.rate ?? ''
        if (values.type === 'prime' && !rateValue && primeRate) rateValue = String(primeRate)
        track.innerHTML = `<legend>מסלול ${tracksList.children.length + 1}</legend>
            <button class="remove-track" type="button" aria-label="הסר מסלול">×</button>
            <label class="input-group">סוג מסלול<div class="select-wrap"><select class="track-type">${Object.entries(trackTypes).map(([value, label]) => `<option value="${value}" ${value === (values.type || 'fixed') ? 'selected' : ''}>${label}</option>`).join('')}</select><span class="select-chevron"></span></div></label>
            <label class="input-group">סכום<div class="input-wrap"><input class="track-amount" type="text" inputmode="decimal" value="${displayAmount}" required><span></span></div></label>
            <label class="input-group">תקופה<div class="input-wrap"><input class="track-years" type="text" inputmode="numeric" min="1" max="${maximumYears}" value="${values.years ?? selectedYears}" required><span>שנים</span></div></label>
            <label class="input-group">ריבית<div class="input-wrap"><input class="track-rate" type="number" min="0" max="30" step="0.01" value="${rateValue}" required><span>%</span></div></label>
            <label class="input-group">לוח סילוקין<div class="select-wrap"><select class="track-method"><option value="equal">שפיצר</option><option value="principal">קרן שווה</option></select><span class="select-chevron"></span></div></label>`
        if (rateValue) track.dataset.autoRate = 'true'
        tracksList.appendChild(track)
        track.querySelector('.remove-track').addEventListener('click', () => { if (tracksList.children.length > 1) { track.remove(); renumberTracks(); updateAddButton(); calculate() } })
        track.querySelectorAll('select').forEach(bindSelectFlip)
        track.querySelectorAll('input, select').forEach(input => {
            input.addEventListener('input', event => {
                if (event.target.classList.contains('track-amount')) {
                    formatAmountInput(event.target)
                    delete event.target.closest('.mortgage-track').dataset.loanShare
                    syncStartingAmountFromTracks()
                }
                if (event.target.classList.contains('track-years')) {
                    constrainTrackYears(event.target)
                    syncTermSliderFromTracks()
                }
                if (event.target.classList.contains('track-rate')) {
                    delete event.target.closest('.mortgage-track').dataset.autoRate
                }
                calculate()
            })
            input.addEventListener('change', event => {
                if (event.target.tagName === 'SELECT') event.target.closest('.select-wrap')?.classList.remove('open')
                if (event.target.classList.contains('track-type')) applyTrackTypeLogic(event.target)
                calculate()
            })
        })
        track.querySelector('.track-amount').addEventListener('blur', event => {
            formatAmountInput(event.target)
            if (getPropertyAmount() > 0) snapTracksToLoan()
            calculate()
        })
        track.querySelector('.track-years').addEventListener('blur', event => {
            constrainTrackYears(event.target)
            if (!event.target.value) event.target.value = '1'
            syncTermSliderFromTracks()
            calculate()
        })
        updateAddButton()
        updateTrackLimits()
    }

    function applyTrackTypeLogic(typeSelect) {
        const track = typeSelect.closest('.mortgage-track')
        const rateInput = track.querySelector('.track-rate')
        if (rateInput.value.trim() && track.dataset.autoRate !== 'true') return
        const rate = typeSelect.value === 'prime'
            ? (getPrimeRate() ?? 5.75)
            : defaultRatesByType[typeSelect.value]
        if (Number.isFinite(rate)) {
            rateInput.value = String(rate)
            track.dataset.autoRate = 'true'
        }
    }

    function applyPrimeRate() {
        const prime = getPrimeRate()
        if (!prime) return
        let changed = false
        tracksList.querySelectorAll('.mortgage-track').forEach(track => {
            if (track.querySelector('.track-type').value !== 'prime') return
            const rateInput = track.querySelector('.track-rate')
            if (!rateInput.value.trim() || track.dataset.autoRate === 'true') {
                rateInput.value = String(prime)
                track.dataset.autoRate = 'true'
                changed = true
            }
        })
        if (changed) calculate()
    }

    function bindSelectFlip(select) {
        const wrap = select.closest('.select-wrap')
        select.addEventListener('mousedown', () => wrap.classList.toggle('open'))
        select.addEventListener('blur', () => wrap.classList.remove('open'))
        select.addEventListener('change', () => wrap.classList.remove('open'))
    }

    function updateIncomePlaceholder(firstMonthPayment) {
        if (firstMonthPayment > 0) {
            const suggested = Math.ceil(firstMonthPayment * 2 / 500) * 500
            monthlyIncomeInput.placeholder = `מינימום: ${currency.format(suggested)}`
        }
    }

    function updateLimitsWarning(firstMonthPayment, loanAmount) {
        const messages = []
        const propertyValue = Number(propertyValueInput.value.replace(/[,\s]/g, '')) || 0
        const capital = Number(initialCapitalInput.value.replace(/[,\s]/g, '')) || 0
        const income = Number(monthlyIncomeInput.value.replace(/[,\s]/g, '')) || 0
        if (capital > 0) {
            const effValue = propertyValue > 0 ? propertyValue : loanAmount + capital
            const equityPct = Math.round(capital / effValue * 100)
            const purpose = purposeLimits[propertyPurposeSelect.value] || purposeLimits.first
            const requiredEquity = 100 - purpose.limit
            equityNote.textContent = `הון עצמי ${equityPct}% משווי הנכס`
            equityNote.classList.toggle('equity-bad', equityPct < requiredEquity)
            equityNote.classList.toggle('equity-good', equityPct >= requiredEquity + 15)
            equityNote.hidden = false
        } else {
            equityNote.classList.remove('equity-bad', 'equity-good')
            equityNote.hidden = true
        }
        if (propertyValue > 0 || capital > 0) {
            const purpose = purposeLimits[propertyPurposeSelect.value] || purposeLimits.first
            const effValue = propertyValue > 0 ? propertyValue : loanAmount + capital
            const ltv = loanAmount / effValue * 100
            if (ltv > purpose.limit + 0.01) {
                const maxLoan = Math.max(0, Math.floor(effValue * purpose.limit / 100 / 1000) * 1000)
                messages.push(`שיעור המימון (${Math.round(ltv)}%) חורג מהמותר בבנק ישראל ל${purpose.label} (עד ${purpose.limit}%) \n על נכס בשווי ${currency.format(effValue)} ניתן לקחת משכנתא של עד ${currency.format(maxLoan)}`)
            }
        }
        if (income > 0 && firstMonthPayment / income > 0.5) {
            const minIncome = Math.ceil(firstMonthPayment * 2 / 500) * 500
            const shortfall = Math.min(99, Math.round((1 - income / minIncome) * 100))
            messages.push(`ההחזר החודשי (${currency.format(firstMonthPayment)}) מחייב הכנסה פנויה חודשית של ${currency.format(minIncome)} לפחות\nלפי תקרת 50% הנהוגה בבנקים — ההכנסה הפנויה חייבת להיות לפחות פי 2 מההחזר החודשי\n(ההכנסה שלכם נמוכה ב-${shortfall}% מהנדרש לתשלומים)`)
        }
        limitsWarning.textContent = messages.join('\n')
        limitsWarning.hidden = messages.length === 0
    }

    function autoFixVariableMix() {
        const tracks = [...tracksList.children]
        if (!tracks.length) return
        const typeSelects = tracks.map(track => track.querySelector('.track-type'))
        const isVar = typeSelects.map(select => variableTrackTypes.includes(select.value))
        if (!isVar.some(v => !v)) {
            const convertIndex = isVar.lastIndexOf(true)
            typeSelects[convertIndex].value = 'fixed'
            applyTrackTypeLogic(typeSelects[convertIndex])
            isVar[convertIndex] = false
        }
        const amounts = tracks.map(getTrackAmount)
        const total = amounts.reduce((sum, amount) => sum + amount, 0)
        if (!total) { calculate(); return }
        const varTotal = amounts.reduce((sum, amount, index) => sum + (isVar[index] ? amount : 0), 0)
        if (varTotal / total <= 2 / 3 + 0.0001) { calculate(); return }
        const targetVar = Math.floor(total * 2 / 3)
        let varLeft = targetVar
        const varIndexes = tracks.map((_, index) => index).filter(index => isVar[index])
        varIndexes.forEach((index, order) => {
            const isLast = order === varIndexes.length - 1
            const amount = isLast ? varLeft : Math.round(amounts[index] * targetVar / varTotal)
            setTrackAmount(tracks[index], Math.max(0, amount))
            varLeft -= amount
        })
        const fixedTarget = total - targetVar
        let fixedLeft = fixedTarget
        const fixedIndexes = tracks.map((_, index) => index).filter(index => !isVar[index])
        const fixedBase = fixedIndexes.reduce((sum, index) => sum + amounts[index], 0)
        fixedIndexes.forEach((index, order) => {
            const isLast = order === fixedIndexes.length - 1
            const amount = isLast ? fixedLeft : Math.round(amounts[index] / (fixedBase || 1) * fixedTarget)
            setTrackAmount(tracks[index], Math.max(0, amount))
            fixedLeft -= amount
        })
        calculate()
    }

    autofixButton.addEventListener('click', autoFixVariableMix)

    bindSelectFlip(propertyPurposeSelect)
    propertyPurposeSelect.addEventListener('change', calculate)
    ;[propertyValueInput, initialCapitalInput, monthlyIncomeInput].forEach(input => {
        input.addEventListener('input', () => {
            formatAmountInput(input)
            if (input !== monthlyIncomeInput) {
                syncStartingFromProperty()
                scaleTrackAmounts()
            }
            calculate()
        })
        input.addEventListener('blur', () => formatAmountInput(input))
    })

    fetch(boiInterestUrl)
        .then(response => response.json())
        .then(data => {
            const keyRate = Number(data?.currentInterest)
            if (!Number.isFinite(keyRate) || keyRate <= 0) return
            window.mortgagePrimeRate = Math.round((keyRate + primeMargin) * 100) / 100
            applyPrimeRate()
        })
        .catch(() => {})

    function updateAddButton() {
        const addButton = document.getElementById('add-track')
        const limitReached = tracksList.children.length >= maximumTracks
        addButton.hidden = limitReached
    }

    function updateTrackLimits() {
        tracksList.querySelectorAll('.track-amount').forEach(input => input.removeAttribute('max'))
        tracksList.querySelectorAll('.track-years').forEach(input => { input.max = maximumYears })
    }

    function renumberTracks() { 
        [...tracksList.children].forEach((track, index) => {
            track.querySelector('legend').textContent = `מסלול ${index + 1}`
        }) 
    }

    function loadPreset(name) {
        if (!presets[name]) return
        const existingTotal = [...tracksList.children].reduce((sum, track) => sum + getTrackAmount(track), 0)
        tracksList.innerHTML = ''
        const startingAmount = getLoanAmount() || existingTotal
        let allocatedAmount = 0
        presets[name].forEach((preset, index) => {
            const amount = index === presets[name].length - 1
                ? startingAmount - allocatedAmount
                : Math.round(startingAmount * preset.share)
            allocatedAmount += amount
            const rate = preset.type === 'prime' ? (getPrimeRate() ?? preset.rate) : preset.rate
            addTrack({ type: preset.type, amount, years: selectedYears, rate })
        })
        renumberTracks()
        document.querySelectorAll('.preset-button').forEach(button => button.classList.toggle('active', button.dataset.preset === name))
        startingPointDirty = false
        calculate()
    }

    function getTrackResult(track) {
        const amount = track.querySelector('.track-amount').value.replace(/[₪,\s]/g, '')
        const principal = Number(amount)
        const months = (Number(track.querySelector('.track-years').value) || 0) * 12
        const annualRate = Number(track.querySelector('.track-rate').value) || 0
        const trackType = track.querySelector('.track-type').value
        const isIndexed = trackType.includes('Indexed')
        const isVariable = variableTrackTypes.includes(trackType)
        const inflationRate = Number.isFinite(window.mortgageIndexData?.annualChange) ? window.mortgageIndexData.annualChange : fallbackInflation
        const monthlyRate = annualRate / 100 / 12
        const monthlyInflation = Math.pow(1 + inflationRate, 1 / 12)
        const method = track.querySelector('.track-method').value
        if (!Number.isFinite(principal) || principal <= 0 || months <= 0 || months > maximumYears * 12 || !Number.isFinite(annualRate) || annualRate < 0) return null

        let balance = principal, totalPaid = 0, totalInterest = 0, firstPayment = 0, highestPayment = 0, indexFactor = 1
        const yearlyRows = []
        let yearOpening = principal, yearPrincipal = 0, yearPaid = 0, yearInterest = 0

        for (let month = 1; month <= months; month++) {
            if (isIndexed && month > 1) {
                indexFactor *= monthlyInflation
                balance *= monthlyInflation
            }
            const remaining = months - month + 1
            const interest = balance * monthlyRate
            let principalPart, payment
            if (method === 'principal') {
                principalPart = principal * indexFactor / months
                payment = principalPart + interest
            } else {
                payment = monthlyRate === 0 ? balance / remaining : balance * monthlyRate / (1 - Math.pow(1 + monthlyRate, -remaining))
                principalPart = payment - interest
            }
            if (month === 1) firstPayment = payment
            highestPayment = Math.max(highestPayment, payment)

            balance = Math.max(0, balance - principalPart)
            totalPaid += payment; totalInterest += interest; yearPrincipal += principalPart; yearPaid += payment; yearInterest += interest

            if (month % 12 === 0 || month === months) {
                yearlyRows.push({ year: Math.ceil(month / 12), opening: yearOpening, principal: yearPrincipal, paid: yearPaid, interest: yearInterest, closing: balance })
                yearOpening = balance; yearPrincipal = 0; yearPaid = 0; yearInterest = 0
            }
        }
        return { firstPayment, highestPayment, totalPaid, totalInterest, yearlyRows, type: trackType, years: months / 12, principal, isVariable, isIndexed, method }
    }

    function calculate(event) {
        if (event) event.preventDefault()
        updateTrackLimits()
        const invalidTerm = [...tracksList.children].some(track => {
            const years = Number(track.querySelector('.track-years').value)
            return !years || years < 1 || years > maximumYears
        })
        if (invalidTerm) {
            formError.textContent = 'תקופת ההלוואה יכולה להיות בין שנה ל-30 שנים.'
            formError.hidden = false
            return
        }
        const tracks = [...tracksList.children]
        const results = tracks.map(getTrackResult)
        tracks.forEach(track => track.classList.remove('variable-limit-flag'))
        autofixButton.hidden = true
        const enteredResults = results.filter((result, index) => {
            return tracks[index].querySelector('.track-amount').value.trim()
        })
        if (!enteredResults.length) {
            formError.textContent = ''
            formError.hidden = true
            limitsWarning.hidden = true
            equityNote.hidden = true
            updateLimitsWarning(0, 0)
            updateIncomePlaceholder(0)
            document.getElementById('monthly-payment').textContent = currency.format(0)
            document.getElementById('total-interest').textContent = currency.format(0)
            document.getElementById('highest-payment').textContent = currency.format(0)
            document.getElementById('total-payment').textContent = currency.format(0)
            document.getElementById('payment-note').textContent = 'הוסיפו מסלול כדי להתחיל'
            document.getElementById('schedule-summary').textContent = ''
            document.getElementById('schedule-body').innerHTML = ''
            document.getElementById('annual-payment').textContent = currency.format(0)
            expandScheduleButton.hidden = true
            return
        }
        if (enteredResults.some(result => !result)) {
            formError.textContent = 'נא להזין סכום חיובי בכל מסלול'
            formError.hidden = false
            return
        }
        formError.textContent = ''
        const totalPrincipal = enteredResults.reduce((sum, result) => sum + result.principal, 0)
        const variablePrincipal = enteredResults.filter(result => result.isVariable).reduce((sum, result) => sum + result.principal, 0)
        if (variablePrincipal / totalPrincipal > 2 / 3 + 0.0001) {
            results.forEach((result, index) => {
                if (result && result.isVariable && enteredResults.includes(result)) tracks[index].classList.add('variable-limit-flag')
            })
            formError.innerHTML = 'בהתאם להוראות בנק ישראל, המסלולים המסומנים בריבית משתנה לא יכולים לעבור 66.66% מסך המשכנתא<br /> הקטינו מסלול מסומן או הגדילו מסלול בריבית קבועה'
            formError.hidden = false
            autofixButton.hidden = false
            return
        }
        formError.hidden = true
        
        const total = enteredResults.reduce((sum, result) => ({ 
            firstPayment: sum.firstPayment + result.firstPayment, 
            highestPayment: sum.highestPayment + result.highestPayment, 
            totalPaid: sum.totalPaid + result.totalPaid, 
            totalInterest: sum.totalInterest + result.totalInterest 
        }), { firstPayment: 0, highestPayment: 0, totalPaid: 0, totalInterest: 0 })
        
        document.getElementById('monthly-payment').textContent = currency.format(total.firstPayment)
        document.getElementById('total-interest').textContent = currency.format(total.totalInterest)
        document.getElementById('highest-payment').textContent = currency.format(total.highestPayment)
        document.getElementById('total-payment').textContent = currency.format(total.totalPaid)
        updateLimitsWarning(total.firstPayment, totalPrincipal)
        updateIncomePlaceholder(total.firstPayment)
        
        const trackCount = enteredResults.length
        const trackText = trackNames[trackCount] || `${trackCount} מסלולים`
        
        const hasIndexed = enteredResults.some(result => result.isIndexed)
        const hasVariable = enteredResults.some(result => result.isVariable)
        const allSpitzer = enteredResults.every(result => result.method !== 'principal')
        
        const highestPaymentLabel = document.getElementById('highest-payment-label')
        let dynamicNote = ''
        
        if (hasIndexed) {
            highestPaymentLabel.textContent = 'ההחזר הגבוה ביותר'
            dynamicNote = 'כולל הצמדה עתידית למדד (ההחזר עשוי לעלות)'
        } else if (!allSpitzer) {
            highestPaymentLabel.textContent = 'ההחזר החודשי הראשון (הגבוה)'
            dynamicNote = 'בקרן שווה ההחזר יורד עם השנים'
        } else if (hasVariable) {
            highestPaymentLabel.textContent = 'ההחזר החודשי הנוכחי'
            dynamicNote = enteredResults.some(result => result.type === 'variable5y' || result.type === 'variableIndexed5y')
                ? 'הריבית במסלולים המשתנים מובטחת רק עד למועד העדכון (כל 5 שנים)'
                : 'בהנחה שהריבית לא תשתנה (בפועל הריבית עשויה להשתנות)'
        } else {
            highestPaymentLabel.textContent = 'ההחזר החודשי הקבוע'
            dynamicNote = 'בתמהיל לא צמוד ושפיצר, ההחזר זהה לאורך כל התקופה'
        }
        
        document.getElementById('payment-note').textContent = `${trackText} · ${dynamicNote}`
        document.getElementById('schedule-summary').textContent = enteredResults.map(result => trackTypes[result.type]).join(' · ')
        
        const combinedSchedule = []
        const scheduleYears = Math.max(...enteredResults.map(result => result.yearlyRows.length))
        for (let index = 0; index < scheduleYears; index++) {
            const rows = enteredResults.map(result => result.yearlyRows[index]).filter(Boolean)
            combinedSchedule.push({
                year: index + 1,
                opening: rows.reduce((sum, row) => sum + row.opening, 0),
                principal: rows.reduce((sum, row) => sum + row.principal, 0),
                paid: rows.reduce((sum, row) => sum + row.paid, 0),
                interest: rows.reduce((sum, row) => sum + row.interest, 0),
                closing: rows.reduce((sum, row) => sum + row.closing, 0)
            })
        }
        document.getElementById('annual-payment').textContent = currency.format(combinedSchedule[0]?.paid || 0)
        const rowsToShow = scheduleExpanded ? 30 : 15
        document.getElementById('schedule-body').innerHTML = combinedSchedule.slice(0, rowsToShow).map(row => `<tr><td>${row.year}</td><td>${currency.format(row.principal)}</td><td>${currency.format(row.interest)}</td><td>${currency.format(row.closing)}</td></tr>`).join('')
        expandScheduleButton.hidden = scheduleYears <= 15
        const maxYears = Math.max(...enteredResults.map(result => result.years))
        expandScheduleButton.textContent = scheduleExpanded ? 'הצג 15 שנים ראשונות' : `הצג פירוט ל-${maxYears} שנים`
    }

    document.querySelectorAll('.preset-button').forEach(button => button.addEventListener('click', () => {
        loadPreset(button.dataset.preset)
    }))
    
    startingAmountInput.addEventListener('input', () => {
        startingPointDirty = true
        formatAmountInput(startingAmountInput)
        scaleTrackAmounts()
        calculate()
    })
    startingAmountInput.addEventListener('blur', () => formatAmountInput(startingAmountInput))
    
    termYearsInput.addEventListener('input', () => {
        startingPointDirty = true
        updateTermSlider()
        applySelectedYears()
        calculate()
    })
    
    window.addEventListener('mortgage-index-updated', calculate)
    window.addEventListener('resize', updateTermSlider)
    
    document.getElementById('add-track').addEventListener('click', () => { 
        if (tracksList.children.length < maximumTracks) { 
            addTrack({ years: selectedYears })
            renumberTracks()
        } 
    })
    
    form.addEventListener('submit', event => {
        event.preventDefault()
        const activePreset = document.querySelector('.preset-button.active')?.dataset.preset
        if (activePreset && startingPointDirty) loadPreset(activePreset)
        else {
            if (startingPointDirty) {
                scaleTrackAmounts()
                applySelectedYears()
                updateTrackLimits()
                startingPointDirty = false
            }
            calculate()
        }
        if (!formError.textContent) {
            resultsLayout.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
    })
    
    expandScheduleButton.addEventListener('click', () => { scheduleExpanded = !scheduleExpanded; calculate() })
    
    document.getElementById('reset-calculator').addEventListener('click', () => {
        tracksList.innerHTML = '';
        startingAmountInput.value = '1,000,000';
        startingAmountInput.disabled = false;
        propertyValueInput.value = '';
        initialCapitalInput.value = '';
        termYearsInput.value = '30';
        updateTermSlider();
        scheduleExpanded = false;
        loadPreset('basket1')
    })
    
    startingAmountInput.value = '1,000,000'
    updateTermSlider()
    loadPreset('basket1')
})()