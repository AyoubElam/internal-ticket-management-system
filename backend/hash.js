const bcrypt = require('bcryptjs')
   bcrypt.hash('Password123!', 12).then(hash => console.log(hash))