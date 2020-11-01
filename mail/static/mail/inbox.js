document.addEventListener('DOMContentLoaded', function () {
  document.querySelector('#inbox').addEventListener('click', () => load_mailbox('inbox'));
  document.querySelector('#sent').addEventListener('click', () => load_mailbox('sent'));
  document.querySelector('#archived').addEventListener('click', () => load_mailbox('archive'));
  document.querySelector('#compose').addEventListener('click', compose_email);
  document.querySelector('#read-archive').addEventListener('click', function () {
    toggle_archive_flag(this.dataset.email, this.dataset.archived);
  });
  document.querySelector('#read-reply').addEventListener('click', function () {
    reply_email(this.dataset.email);
  });
  document.querySelector('#compose-form').onsubmit = submit_form;

  // By default, load the inbox
  load_mailbox('inbox');
});

function compose_email() {

  // Show compose view and hide other views
  show_view_div('view-compose');

  // Clear out composition fields
  document.querySelectorAll(`[id*="form-"]`).forEach(item => {
    item.value = '';
    item.className = 'form-control';
  })
}

function show_view_div(view_div) {
  document.querySelectorAll(`[id*="view-"]`).forEach(item => {
    item.style.display = (view_div === item.id ? 'block' : 'none');
  })
  document.body.scrollTop;
}

function load_mailbox(mailbox) {
  const readStyle = 'list-group-item-secondary'; // email've been read should display in gray color
  const defaultStyle = 'list-group-item list-group-item-action '; // action - white color

  fetch(`/emails/${mailbox}`)
    .then(res => {
      if (!res.ok) {
        throw Error(res.status + ' - ' + res.statusText);
      }
      return res.json();
    })
    .then(emails => {
      const ele = document.querySelector('#view-emails');
      // Show the mailbox name
      ele.innerHTML = `<h3>${mailbox.charAt(0).toUpperCase() + mailbox.slice(1)}</h3>`;

      show_view_div('view-emails');

      if (!emails.length) {
        return ele.innerHTML += '<h3>No Emails Found.</h3>';
      }
      emails.map(email => {
        const listItem = document.createElement('a');
        listItem.addEventListener('click', () => {
          read_email(email.id, (mailbox === 'sent'));
        });
        listItem.className = defaultStyle + (email.read ? readStyle : ''); // read is gray, unread is white
        listItem.href = '#';
        let content = (mailbox !== 'sent' ? `<b>From:</b> ${email.sender} <br/>` : '');
        content += (mailbox !== 'inbox' ? `<b>To:</b> ${email.recipients} <br/>` : '');
        content += `<b>Subject:</b>` + (email.subject ? email.subject : ` (No Subject)`) + `<br/>`;
        content += `<span class="badge badge-info badge-pill">${email.timestamp}</span>`;
        listItem.innerHTML = content;
        ele.append(listItem);
      })
    }).catch(e => {
      handle_error(e);
    });
}

function toggle_archive_flag(email_id, archived) {
  update_email_flags(email_id, true, archived !== 'true', () => {
    load_mailbox('inbox');
  });
}

function get_email(email_id, process_response) {
  fetch(`/emails/${email_id}`)
    .then(res => {
      if (!res.ok) {
        throw Error(res.status + ' - ' + res.statusText);
      }
      return res.json();
    })
    .then(email => {
      return process_response(email);
    })
    .catch(e => {
      handle_error(e);
    })
}

function read_email(email_id, hide_archive = false) {
  get_email(email_id, (email) => {
    const emailData = ['sender', 'recipients', 'timestamp', 'subject', 'body'];
    emailData.map(key => {
      document.querySelector(`#${key}`).innerText = (email[key] ? email[key] : `(No ` + key.charAt(0).toUpperCase() + key.slice(1) + ')');
    });
    document.querySelectorAll(`[id*="read-"]`).forEach(item => {
      item.dataset.email = email.id;
      if (item.id === 'read-archive') {
        if (hide_archive) {
          item.style.display = 'none';
        } else {
          item.textContent = (email.archived ? 'Un-Archive' : 'Archive');
          item.dataset.archived = email.archived;
          item.style.display = 'block';
        }
      }
    });
    if (!email.read)
      update_email_flags(email.id, true, email.archived);
    show_view_div('view-read');
  })
}

function reply_email(email_id) {
  get_email(email_id, (email) => {
    const emailData = {
      'sender': 'form-recipients',
      'subject': 'form-subject',
      'body': 'form-body'
    }
    for (const key in emailData) {
      if (key === 'subject') {
        email[key] = (email.subject.startsWith('Re: ') ? email.subject : "Re: " + email.subject);
      } else if (key === 'body') {
        email[key] = `\n===========\nOn ${email.timestamp} ${email.sender} wrote:` + ` \n${email.body}`;
      }
      const formField = document.querySelector(`#${emailData[key]}`);
      formField.value = email[key];
      formField.className = 'form-control';
    }
    document.querySelector('#compose-title').innerHTML = `<h3>Reply to Email</h3>`;
    show_view_div('view-compose');
  });
}

function update_email_flags(email_id, read = true, archived = false, process_response) {
  fetch(`/emails/${email_id}`, {
    method: 'PUT',
    body: JSON.stringify({
      archived: archived,
      read: read
    })
  }).then(res => {
    if (!res.ok) {
      throw Error(res.status + ' - ' + res.statusText);
    }
    if (process_response) {
      process_response();
    }
    return true;
  }).catch(e => {
    handle_error(e);
  })
}

function submit_form() {
  const inputRecipients = document.querySelector('#form-recipients');
  let form_valid = () => {
    if (!inputRecipients.value) {
      inputRecipients.className = 'form-control is-invalid';
      return false;
    }
    inputRecipients.className = 'form-control is-valid';
    return true;
  }
  if (form_valid()) {
    fetch('/emails', {
      method: 'POST',
      body: JSON.stringify({
        recipients: inputRecipients.value,
        subject: document.querySelector('#form-subject').value,
        body: document.querySelector('#form-body').value,
        read: false,
        archived: false
      })
    })
    .then(res => res.json())
    .then(result => {
      if (result.error) {
        document.querySelector('#recipients-alert').textContent = result.error;
        document.querySelector('#form-recipients').className = 'form-control is-invalid';
      } else {
        load_mailbox('sent');
      }
    })
    .catch(e => {
      handle_error(e);
    });
  }
  return false;
}

function handle_error(error) {
  document.querySelector('#view-error').innerHTML = `<h1>A Problem Occurred.</h1><p>${error.message}</p>`;
  show_view_div('view-error');
  console.log(error);
}