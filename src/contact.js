const submit = document.getElementById('submit')
submit.addEventListener('click', submitForm())

function submitForm(event) {
    event.preventDefault()

    let name = document.getElementById('name')
    let email = document.getElementById('email')
    let phone = document.getElementById('phone')
    let message = document.getElementById('message')
    
    alert(name + ' ' + email + ' ' + phone + ' ' + message)

    document.getElementById('contact-form').reset()

}



