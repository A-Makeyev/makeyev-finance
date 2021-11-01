const form = document.getElementById('contact-form')
const status = document.getElementById('submit-status')

form.addEventListener('submit', (event) => {
    event.preventDefault()
  
    let data = new FormData(event.target)
    fetch(event.target.action, {
        method: form.method,
        body: data,
        headers: {
            'Accept': 'application/json'
        }
    }).then(response => {
        status.style.opacity = '1'
        status.innerHTML = 'Sent 😁'
        setTimeout(() => {
            status.style.opacity = '0'
            setTimeout(() => {
                status.style.display = 'none'
                form.reset()
            }, 1000)
        }, 2000)
    }).catch(error => {
        status.style.opacity = '1'
        status.innerHTML = '&#9888;'
        setTimeout(() => {
            status.style.opacity = '0'
            setTimeout(() => {
                status.style.display = 'none'
                form.reset()
            }, 1000)
        }, 2000)
    })
})
