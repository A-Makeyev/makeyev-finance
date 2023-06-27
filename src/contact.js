// prevent modal animation on page load
if (messageModal) messageModal.style.display = 'none'
if (actionFormModal) actionFormModal.style.display = 'none'

setTimeout(() => {
    if (messageModal) messageModal.style.display = 'block'
    if (actionFormModal) actionFormModal.style.display = 'block'
}, 2500)

// add contact details
function addContactDetails(contact, text, link) {
    let select = (type) => { return document.querySelector(type) }
    if (select(contact + '-link')) select(contact + '-link').href = link
    if (select(contact + '-text')) select(contact + '-text').textContent = text
}

addContactDetails('.main-phone', mainPhone, callTo)
addContactDetails('.main-email', mainEmail, mailToLink)
addContactDetails('.main-address', mainAddress, wazeLink)

// add google maps
if (map) {
    map.setAttribute('src', googleMap)
    for (let x = 0 ; x < wazeAddresses.length; x++) {
        if (wazeAddresses[x].classList.contains('iframe-link')) {
            wazeAddresses[x].classList.remove('iframe-link')
        }
    }
}

for (let x = 0 ; x < wazeAddresses.length; x++) {
    wazeAddresses[x].setAttribute('href', wazeLink)
}

// add a button to fill form on dev environment
function fillForm() {
    if (window.location.href.includes(`${dev}/contact`)) {
        let button = document.createElement('button')
        button.className = 'hero-btn btn-orange remove-highlight'
        button.style.boxShadow = 'var(--orange-shadow)'
        button.setAttribute('id', 'dev-btn')
        button.textContent = 'add details'
        button.style.marginTop = '10px'
        button.style.width = '110%'

        contactForm.appendChild(button)

        function alignButton() {
            if (window.matchMedia('(max-width: 1600px)').matches) {
                button.style.display = 'none'
            } else {
                button.style.display = 'inline-block'
            }
        }

        window.addEventListener('DOMContentLoaded', alignButton)
        window.addEventListener('resize', alignButton)

        button.addEventListener('click', () => {
            let details = [
                randomName(),
                randomPhone(),
                randomEmail(),
                'Baguette Du Fromage '
            ]

            for (let x = 0; x < formLabels.length; x++) {
                setTimeout(() => {
                    if (x == 3) details[x] = details[x].repeat(9)
                    formInputs[x].focus()
                    formInputs[x].value = details[x]
                }, (x * 500))
            }
            allowSubmit()
            setTimeout(() => { 
                submitForm.click() 
            }, 3000)
        })
    }
}
fillForm()

// reset labels after submit
function resetLabels() {
    for (let x = 0; x < formInputs.length; x++) {
        formInputs[x].style.boxShadow = 'var(--black-shadow)'
        formInputs[x].style.border = `1px solid ${softBlack}`
        formLabels[x].style.color = softGrey
        formLabels[x].style.cursor = 'text'
        formLabels[x].style.left = '20px'
        formLabels[x].style.top = '35px'
    }
}

for (let x = 0; x < formInputs.length; x++) {
    // input labels go up on focus
    formInputs[x].addEventListener('focus', () => {
        formInputs[x].style.boxShadow = 'var(--black-shadow)'
        formInputs[x].style.border = `2px solid ${softBlack}`
        formLabels[x].style.color = softBlack
        formLabels[x].style.cursor = 'default'
        formLabels[x].style.top = '0'

        if (language == 'english') {
            formLabels[x].style.left = '0'
        }

        if (language == 'english') {
            setTimeout(() => {
                if (formLabels[x].textContent.slice(-1) !== ':') {
                    formLabels[x].textContent += ':'
                }
            }, 250)
        }
    })

    // input labels go down on blur
    formInputs[x].addEventListener('blur', () => {
        let value = formInputs[x].value
        if (value.length < 1 && value === '') {
            formInputs[x].style.boxShadow = 'var(--black-shadow)'
            formInputs[x].style.border = `1px solid ${softBlack}`
            formLabels[x].style.color = softGrey
            formLabels[x].style.cursor = 'text'
            formLabels[x].style.top = '35px'

            if (language == 'hebrew') {
                formLabels[x].style.left = '40px'
            } else if (language == 'english') {
                formLabels[x].style.left = '20px'
            }

            if (language == 'english') {
                setTimeout(() => {
                    let text = formLabels[x].textContent.slice(0, -1)
                    formLabels[x].textContent = text
                }, 250)
            }
        }
    })
}

function changeColor(element, color) {
    element.style.borderColor = color
    element.previousElementSibling.style.color = color
    element.style.boxShadow = color == softRed ? 'var(--red-shadow)' : 'var(--blue-shadow)'
}

function validateForm() {
    let validName = nameRegex.test(inputName.value) 
    let validPhone = phoneRegex.test(inputPhone.value)
    let validEmail // action form doesn't include email

    inputName.onblur = () => {
        if (!validName) {
            changeColor(inputName, softRed)
        } else {
            changeColor(inputName, softBlue)
        }
    }

    inputPhone.onblur = () => {
        if (!validPhone) {
            changeColor(inputPhone, softRed)
        } else {
            changeColor(inputPhone, softBlue)
        } 
    }

    if (inputEmail !== null) {
        validEmail = emailRegex.test(inputEmail.value) 
        inputEmail.onblur = () => {
            if (!validEmail) {
                changeColor(inputEmail, softRed)
            } else {
                changeColor(inputEmail, softBlue)
            } 
        }
    }

    if (inputEmail !== null) {
        validName && validPhone && validEmail ? allowSubmit() : preventSubmit()
    } else {
        validName && validPhone ? allowSubmit() : preventSubmit()
    }
}

function allowSubmit() {
    submitForm.disabled = false
    submitForm.style.cursor = 'pointer'
    submitForm.classList.remove('btn-black')
    submitForm.classList.add('btn-blue')
}

function preventSubmit() {
    submitForm.disabled = true
    submitForm.style.cursor = 'not-allowed'
    submitForm.classList.remove('btn-blue')
    submitForm.classList.add('btn-black')
}

function resetFormOnError() {
    if (action !== null) {
        actionFormModal.classList.remove('active')
    }

    // don't include name with error message
    modalUser.style.display = 'none'
    displayModalContent('failure')
    allowSubmit()

    if (language == 'hebrew') {
        submitForm.textContent = 'שלחו'
    } else if (language == 'english') {
        submitForm.textContent = 'Send'
    }

    submitForm.style.pointerEvents = 'all'
}

// submit form & send email only if user is online
contactForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    document.body.style.cursor = 'progress'

    preventSubmit()
    submitForm.style.pointerEvents = 'none'
    submitForm.classList.remove('btn-black')
    submitForm.classList.add('btn-blue')

    if (language == 'hebrew') {
        submitForm.innerHTML = '<i class="fas fa-paper-plane spin"></i>'
    } else if (language == 'english') {
        submitForm.textContent = 'Sending'
        for (let x = 0; x < 3; x++) {
            setTimeout(() => {
                submitForm.textContent += '.'
                if (x === 2) submitForm.innerHTML += '<i class="fas fa-paper-plane spin"></i>'
            }, (x * 250))
        }
    }

    // user is online
    if (window.navigator.onLine) {        
        sendEmail()
    // user is offline
    } else { 
        resetFormOnError()
    }
    return false
})

// display modal with a status
function displayModalContent(status) {
    let firstName = inputName.value.split(' ')[0]

    if (status === 'success') {
        modalTitle.style.color = softGreen
        modal.style.border = `2px solid ${softGreen}`
        modalHeader.style.borderBottom = `2px solid ${softGreen}`
        modalLinks[0].style.display = 'block'
        modalUser.style.display = 'block'

        if (language == 'hebrew') {
            modalTitle.textContent = 'ההודעה נשלחה'
            modalUser.textContent = `תודה על פנייתך ${firstName}`
            modalBody.textContent = 'נדאג שיחזרו אליך בהקדם'
        } else if (language == 'english') {
            modalTitle.textContent = 'message sent!'
            modalUser.textContent = `Thanks ${firstName},`
            modalBody.textContent = 'we will get back to you as soon as possible'
        }
    } else if (status === 'failure') {
        modalTitle.style.color = softRed
        modal.style.border = `2px solid ${softRed}`
        modalHeader.style.borderBottom = `2px solid ${softRed}`
        modalLinks[0].style.display = 'none'

        if (language == 'hebrew') {
            modalTitle.textContent = 'ההודעה לא נשלחה'
            modalBody.innerHTML = 
            `
                <p>
                    הייתה תקלה בשליחת ההודעה, אפשר ליצור איתנו קשר במספר
                    <a href="tel:${mainPhone}" class="modal-body-phone">${mainPhone}</a>
                    ונדאג לחזור אליכם בהקדם
                </p>
            `
        } else if (language == 'english') {
            modalTitle.textContent = 'Oops!'
            modalBody.textContent = `there seems to be a problem with your internet connection, feel free to reach us at ~ ${mainPhone}`
        }
    } 

    setTimeout(() => {
        modal.classList.add('active')
        overlay.classList.add('active')
        document.body.style.cursor = 'default'
    }, 150)
}

// close modals when clicking on close modal button
closeModal.forEach(button => {
    button.addEventListener('click', () => {
        let modal = button.closest('.modal')
        if (modal !== null) modal.classList.remove('active')
        if (actionFormModal !== null) actionFormModal.classList.remove('active')
        
        overlay.classList.remove('active')
        if (window.navigator.onLine) {
            contactForm.reset()
            preventSubmit()
            resetLabels()
        }
    })
})

// close modals when clicking on overlay
overlay.addEventListener('click', () => {
    const activeModals = document.querySelectorAll('.active')
    activeModals.forEach(modal => {
        if (modal == null) return
        modal.classList.remove('active')
        overlay.classList.remove('active')
        if (window.navigator.onLine) {
            contactForm.reset()
            preventSubmit()
            resetLabels()
        }
    })
})

// close modal when pressing esc
body.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { 
        closeModal.forEach(btn => btn.click())
        if (window.navigator.onLine) {
            contactForm.reset()
            preventSubmit()
            resetLabels()
        }
    }
})

// add form reset when clicking on modal links
if (typeof modalLinks[0] !== 'undefined') {
    for (let x = 0; x < modalLinks[0].children.length; x++) {
        modalLinks[0].children[x].onclick = () => { 
            if (window.navigator.onLine) {
                contactForm.reset()
            }
        }
    }
}

// action form modal
if (action !== null) {
    action.addEventListener('click', () => {
        actionFormModal.classList.add('active')
        overlay.classList.add('active')
    })
}

function sendEmail() {
    try {
        Email.send({
            // https://smtpjs.com
            // https://elasticemail.com
            // SMTP Host & Domain -> smtp.elasticemail.com
            SecureToken: mainSmtpToken,
            To: mainEmail,
            From: mainEmail,
            Subject: 'New Client 🤑',
            Body: createEmailBody()
    
        }).then(response => {
            // handle communication buffer resources
            if (response.includes('deadlock victim')) {
                log(response, softOrange)
                log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@', softYellow)
                log(`Process (${response.match(/\d/g).join('')}) was deadlocked, resending email...`, softOrange)
                log('@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@', softYellow)
                sendEmail()
            } else if (!response.includes('OK')) {
                log(response, softRed)
                resetFormOnError()
            } else {
                if (action !== null)
                    actionFormModal.classList.remove('active')
    
                resetLabels()
                displayModalContent('success')
    
                preventSubmit()
                contactForm.reset()
    
                setTimeout(() => {
                    if (language == 'hebrew') {
                        submitForm.textContent = 'שלחו'
                    } else if (language == 'english') {
                        submitForm.textContent = 'Send'
                    }
                }, 1000)
    
                submitForm.style.pointerEvents = 'all'
                log(`Email has been sent with status: ${response}`, softGreen)
            }
    
        })
    } catch(error) {
        displayModalContent('failure')
        resetFormOnError()
    }
}

function createEmailBody() {
    let userName = inputName.value
    let userPhone = inputPhone.value
    let userMessage = inputMessage.value
    let userEmail = inputEmail !== null ? inputEmail.value : null

    if (userMessage.trim() === '') {
        if (language == 'hebrew') {
            userMessage = 'אשמח לייעוץ כללי'
        } else if (language == 'english') {
            userMessage = 'I would like some advice'
        }
    }

    return `
            <div>
                <h4>
                    <span>New submission from</span> 
                    <a href="${prod}" target="_blank" style="text-decoration: none;">
                        <span style="color: ${softBlue};">Makeyev Finance</span>
                    </a>
                </h4>
                <p style="color: ${softBlack}; font-weight: 600;">Sent on ${currentDateTime()}</p>
                <table style="border: 1px solid ${softGrey}; border-collapse: collapse; width: 100%;">
                    <tbody style="font-family: 'Fira Code', sans-serif; font-size: 15px; text-align: center; color: ${softBlack}">
                        <tr style="border: 1px solid ${softBlue}; background: ${softBlue}; color: ${softWhite}; padding: 15px 10px;">
                            <td style="padding: 10px;"><strong>Details</strong></td>
                            <td></td>
                        </tr>
                        <tr style="border: 1px solid ${softGrey};">
                            <td style="width: 20%; border-right: 1px solid ${softGrey}; padding: 10px;">
                                <strong>Name</strong>
                            </td>
                            <td style="padding:10px;">
                                <pre style="margin: 0; white-space: pre-wrap;">${userName}</pre>
                            </td>
                        </tr>

                        <tr style="border: 1px solid ${softGrey};">
                            <td style="width: 20%; border-right: 1px solid ${softGrey}; padding: 10px;">
                                <strong>Phone</strong>
                            </td>
                            <td style="padding: 10px;">
                                <a href="tel:${userPhone}" target="_blank" style="margin: 0; white-space: pre-wrap; text-decoration: none;">${userPhone}</a>
                            </td>
                        </tr>

                        ${inputEmail !== null ?
                        ` 
                            <tr style="border: 1px solid ${softGrey};">
                                <td style="width: 20%; border-right: 1px solid ${softGrey}; padding: 10px;">
                                    <strong>Email</strong>
                                </td>
                                <td style="padding: 10px;">
                                    <a href="mailto:${userEmail}" target="_blank" style="margin: 0; white-space: pre-wrap; text-decoration: none;">${userEmail}</a>
                                </td>
                            </tr>
                        `   
                        : ``}

                        ${userMessage.trim() !== '' ? 
                        `
                            <tr style="border: 1px solid ${softGrey};">
                                <td style="width: 20%; border-right: 1px solid ${softGrey}; padding: 10px;">
                                    <strong>Message</strong>
                                </td>
                                <td style="padding: 10px;">
                                    <pre style="margin: 0; white-space: pre-wrap;">${userMessage}</pre>
                                </td>
                            </tr>
                        `
                        : ``}

                    </tbody>
                </table>
                <div style="text-align: center; margin-top: 50px;">
                    <img src="${prod}/images/M-LIGHT.png" style="max-width: 250px;">
                </div>
            </div>
           `
}
