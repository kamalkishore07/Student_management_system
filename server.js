const express = require('express');
const path = require('path');
const { MongoClient, ObjectId } = require('mongodb');
const session = require('express-session');
const ExcelJS = require('exceljs');
const app = express();
const port = 3000;

const url = 'mongodb://localhost:27017';
const dbName = 'userdb';
let db;

async function connectToDatabase() {
    try {
        const client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
        await client.connect();
        db = client.db(dbName);
        console.log('Connected to database');
    } catch (err) {
        console.error('Failed to connect to the database', err);
    }
}

connectToDatabase();

app.use(session({
    secret: 'secret-key', // Change this to a secure random string
    resave: false,
    saveUninitialized: true
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

function requireLogin(req, res, next) {
    if (req.session && req.session.userId) {
        // User is authenticated, allow access to the route
        return next();
    } else {
        // User is not authenticated, redirect to login page
        res.redirect('/login');
    }
}

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'form1.html'));
});

app.get('/cgpa', (req, res) => {
    res.sendFile(path.join(__dirname, 'form2.html'));
});

app.get('/aindex', (req, res) => {
    res.sendFile(path.join(__dirname, 'aindex.html'));
});

app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'login.html'));
});

app.get('/details', requireLogin, async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    try {
        if (!db) throw new Error('Database not connected');

        const usersData = await db.collection('users').find({}, { projection: { username: 0, password: 0 } })
            .skip(skip).limit(limit).toArray();
        const totalUsers = await db.collection('users').countDocuments();
        const totalPages = Math.ceil(totalUsers / limit);

        if (usersData.length === 0) {
            return res.status(404).send('<h1>No user data available</h1>');
        }

        let tableHtml = '<table><thead><tr>';
        const fields = ['rollno', 'name', 'phone', 'email', 'dob', 'fathersname', 'mothersname', 'parentsphone', 'gender', 'course', 'branch', 'section', 'year', 'residencestatus'];
        fields.forEach(field => tableHtml += `<th>${field}</th>`);
        tableHtml += '<th>Actions</th><th>CGPA</th></tr></thead><tbody>';

        // Fetch CGPA data for all users
        const cgpaDataMap = new Map(); // To store CGPA data keyed by roll number
        const cgpaCursor = await db.collection('cgpas').find({});
        await cgpaCursor.forEach(cgpa => {
            cgpaDataMap.set(cgpa.rollno, cgpa.cgpa);
        });

        usersData.forEach(user => {
            tableHtml += '<tr>';
            fields.forEach(field => tableHtml += `<td>${user[field]}</td>`);
            // Include CGPA for each user
            const cgpa = cgpaDataMap.get(user.rollno) || 'N/A'; // If CGPA not found, display 'N/A'
            tableHtml += `<td>
                <a href="/update-user?userId=${user._id}" class="btn">Update</a>
                <a href="/delete-user?userId=${user._id}" class="btn">Delete</a>
                <a href="/c?rollno=${user.rollno}" class="btn">View CGPA</a>
            </td><td>${cgpa}</td></tr>`;
        });

        tableHtml += '</tbody></table>';

        const paginationHtml = `<nav aria-label="Page navigation">
            <ul class="pagination">
                ${Array.from({ length: totalPages }, (_, i) => `<li><a href="/details?page=${i + 1}&limit=${limit}">${i + 1}</a></li>`).join(' ')}
            </ul>
        </nav>`;

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>User Details</title>
                <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                    text-decoration: none;
                    border: none;
                    outline: none;
                    scroll-behavior: smooth;
                    font-family: 'Nunito', sans-serif;
                }

                ::selection {
                    color: #000000;
                    background-color: rgba(255, 255, 255, 0.5);
                }

                :root {
                    --bg-color: #171F38;
                    --snd-bf-color: #262840;
                    --text-color: #fff;
                    --main-color: #5982f4;
                    --link-color: #FFC107;
                    --box-color: #394d5e;
                    --btn-color: #007bff;
                    --btn-hover-color: #0056b3;
                }

                body {
                    background-color: var(--bg-color);
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    color: var(--text-color);
                }

                .container {
                    width: 90%;
                    max-width: 1200px;
                    margin: 20px auto;
                    background-color: var(--box-color);
                    padding: 20px;
                    border-radius: 10px;
                    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 20px;
                    border: 1px solid #ddd;
                }

                th, td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    text-align: left;
                    font-size: 16px;
                }

                th {
                    background-color: var(--snd-bf-color);
                }

                .btn {
                    display: inline-block;
                    padding: 6px 12px;
                    margin-bottom: 0;
                    font-size: 14px;
                    font-weight: 400;
                    line-height: 1.42857143;
                    text-align: center;
                    white-space: nowrap;
                    vertical-align: middle;
                    cursor: pointer;
                    background-image: none;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    color: var(--text-color);
                    background-color: var(--btn-color);
                }

                .btn:hover {
                    background-color: var(--btn-hover-color);
                }

                .pagination {
                    display: inline-block;
                    padding-left: 0;
                    margin: 20px 0;
                    border-radius: 4px;
                }

                .pagination li {
                    display: inline;
                    margin: 0 2px;
                }

                .pagination li a {
                    position: relative;
                    float: left;
                    padding: 6px 12px;
                    line-height: 1.42857143;
                    text-decoration: none;
                    color: #428bca;
                    background-color: #fff;
                    border: 1px solid #ddd;
                }

                .pagination li.active a {
                    background-color: #428bca;
                    color: #fff;
                    border: 1px solid #428bca;
                }

                </style>
            </head>
            <body>
                <div class="container">
                    <h1 style="text-align: center; margin-top: 20px;">User Details</h1>
                    ${tableHtml}
                    ${paginationHtml}
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error fetching user details:', err);
        res.status(500).send('<h1>Server Error</h1><p>Unable to fetch user details.</p>');
    }
});




app.get('/c', async (req, res) => {
    const { rollno } = req.query;
    console.log(rollno);
    try {
        if (!db) throw new Error('Database not connected');

        // Find the CGPA details for the provided roll number
        const cgpaData = await db.collection('cgpas').findOne({ rollno });
    
        if (!cgpaData) {
            return res.status(404).send('<h1>CGPA data not found</h1>');
        }

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>CGPA Details</title>
                <link href="https://stackpath.bootstrapcdn.com/bootstrap/4.5.2/css/bootstrap.min.css" rel="stylesheet">
            </head>
            <body>
                <div class="container">
                    <h1 class="text-center my-4">CGPA Details for Roll Number ${rollno}</h1>
                    <table border="1" class="table table-striped">
                        <thead>
                            <tr>
                                <th>Semester</th>
                                <th>GPA</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${Object.entries(cgpaData.gpa).map(([semester, gpa]) => `
                                <tr>
                                    <td>${semester}</td>
                                    <td>${gpa.toFixed(2)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <h3 class="my-3">Overall CGPA: ${cgpaData.cgpa.toFixed(2)}</h3>
                </div>
            </body>
            </html>
        `);
    } catch (err) {
        console.error('Error fetching CGPA data:', err);
        res.status(500).send('<h1>Server Error</h1><p>Unable to fetch CGPA data.</p>');
    }
});


app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        if (!db) throw new Error('Database not connected');

        const user = await db.collection('users').findOne({ username });
        if (user && password === user.password) {
            req.session.userId = user._id;  // Store user ID in session
            res.redirect('/aindex');
        } else {
            res.send('<h1>Login failed</h1><p>Invalid username or password.</p>');
        }
    } catch (err) {
        console.error('Error during login:', err);
        res.status(500).send('<h1>Server Error</h1><p>Unable to process login.</p>');
    }
});

app.post('/insert', async (req, res) => {
    const { rollno, name, phone, email, dob, fathersname, mothersname, parentsphone, gender, course, branch, section, year, residencestatus, username, password } = req.body;

    try {
        if (!db) throw new Error('Database not connected');

        const userData = {
            rollno, name, phone, email, dob, fathersname, mothersname, parentsphone, gender, course, branch, section, year, residencestatus, username, password
        };
        
        const result = await db.collection('users').insertOne(userData);
 
        const userId = result.insertedId.toHexString();

        console.log('Generated userId:', userId);

        res.redirect(`/cgpa?rollno=${rollno}`);
    } catch (err) {
        console.error('Error inserting user:', err);
        res.status(500).send('<h1>Server Error</h1><p>Unable to save user data.</p>');
    }
});

app.post('/index',  async (req, res) => {
    const { rollno, semesterData, semesterGPAs, cgpa } = req.body;
  console.log(rollno);

    try {
        if (!db) throw new Error('Database not connected');

        const userData = {
            rollno: rollno, // Assuming userId is the roll number
            gpa: JSON.parse(semesterGPAs), // Assuming semesterGPAs is an array of GPAs
            cgpa: parseFloat(cgpa) // Assuming cgpa is the overall CGPA
        };
        console.log(userData);
        // Insert the user's CGPA data into the 'cgpas' collection
        await db.collection('cgpas').insertOne(userData);

        res.redirect('/register');
    } catch (err) {
        console.error('Error storing CGPA data:', err);
        res.status(500).send('<h1>Server Error</h1><p>Unable to store CGPA data.</p>');
    }
});
app.get('/update-user', requireLogin,async (req, res) => {
    const { userId } = req.query;

    try {
        if (!db) {
            throw new Error('Database not connected');
        }
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!user) {
            return res.status(404).send('<h1>User not found</h1>');
        }

        res.sendFile(path.join(__dirname, 'update-user.html'));
    } catch (err) {
        console.error('Error fetching user for update:', err);
        res.status(500).send('<h1>Server Error</h1><p>Unable to fetch user for update.</p>');
    }
});
app.get('/user', async (req, res) => {
    const userId = req.query.userId;
    if (!ObjectId.isValid(userId)) {
        return res.status(400).json({ error: 'Invalid user ID' });
    }

    try {
        if (!db) throw new Error('Database not connected');

        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json(user); // Send user data as JSON
    } catch (err) {
        console.error('Error fetching user data:', err);
        res.status(500).json({ error: 'Unable to fetch user data' });
    }
});

// Handle user update request
app.post('/update-user', requireLogin,async (req, res) => {
    const { userId, ...userData } = req.body;

    try {
        if (!db) throw new Error('Database not connected');

        if (!ObjectId.isValid(userId)) {
            return res.status(400).send('<h1>Invalid user ID</h1>');
        }

        await db.collection('users').updateOne({ _id: new ObjectId(userId) }, { $set: userData });
        res.send('User updated successfully');
    } catch (err) {
        console.error('Error updating user:', err);
        res.status(500).send('<h1>Server Error</h1><p>Unable to update user.</p>');
    }
});

app.get('/delete-user', requireLogin,async (req, res) => {
    const { userId } = req.query;

    try {
        if (!ObjectId.isValid(userId)) {
            return res.status(400).send('<h1>Invalid user ID</h1>');
        }

        if (!db) {
            throw new Error('Database not connected');
        }

        // Find the user by ID
        const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });

        // If user not found, return 404
        if (!user) {
            return res.status(404).send('<h1>User not found</h1>');
        }

        // Delete the user
        await db.collection('users').deleteOne({ _id: new ObjectId(userId) });

        // Redirect to a suitable page after deletion
        res.redirect('/details'); // Redirect to user details page, for example
    } catch (err) {
        console.error('Error deleting user:', err);
        res.status(500).send('<h1>Server Error</h1><p>Unable to delete user.</p>');
    }
});

app.get('/download-data', requireLogin, async (req, res) => {
    try {
        if (!db) {
            throw new Error('Database not connected');
        }

        // Fetch all user data from the database
        const allUserData = await db.collection('users').find({}).toArray();

        // Fetch CGPA data for all users
        const cgpaDataMap = new Map(); // To store CGPA data keyed by roll number
        const cgpaCursor = await db.collection('cgpas').find({});
        await cgpaCursor.forEach(cgpa => {
            cgpaDataMap.set(cgpa.rollno, cgpa.cgpa);
        });

        // Create a new workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('User Data');

        // Add headers to the worksheet
        worksheet.addRow(['Roll Number', 'Name', 'Phone', 'Email', 'DOB', 'Fathers Name', 'Mothers Name', 'Parents Phone', 'Gender', 'Course', 'Branch', 'Section', 'Year', 'Residence Status', 'CGPA']);

        // Add rows for each user
        allUserData.forEach(user => {
            // Fetch CGPA for the user
            const cgpa = cgpaDataMap.get(user.rollno) || 'N/A'; // If CGPA not found, display 'N/A'

            worksheet.addRow([
                user.rollno, user.name, user.phone, user.email, user.dob, user.fathersname, user.mothersname, user.parentsphone, user.gender, user.course, user.branch, user.section, user.year, user.residencestatus, cgpa
            ]);
        });

        // Set headers to trigger file download
        res.setHeader('Content-disposition', 'attachment; filename=userdata.xlsx');
        res.setHeader('Content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

        // Write the workbook to the response
        await workbook.xlsx.write(res);

        res.end(); // End the response
    } catch (err) {
        console.error('Error downloading data:', err);
        res.status(500).send('<h1>Server Error</h1><p>Unable to download data.</p>');
    }
});

app.get('/search-user', requireLogin,async (req, res) => {
    const { name, sortOrder } = req.query;

    try {
        if (!db) throw new Error('Database not connected');

        let query = {};

        if (name) {
            query.name = new RegExp(name, 'i'); // Case-insensitive search for name
        }

        let sortOption = {};

        if (sortOrder) {
            sortOption[sortOrder] = 1; // Sort by the specified field in ascending order
        }

        const usersData = await db.collection('users').find(query).sort(sortOption).toArray();

        if (usersData.length === 0) {
            return res.status(404).send('<h1>No matching users found</h1>');
        }

        let tableHtml = '<table><thead><tr>';
        const fields = ['rollno', 'name', 'phone', 'email', 'dob', 'fathersname', 'mothersname', 'parentsphone', 'gender', 'course', 'branch', 'section', 'year', 'residencestatus'];
        fields.forEach(field => tableHtml += `<th>${field}</th>`);
        tableHtml += '<th>Actions</th></tr></thead><tbody>';

        usersData.forEach(user => {
            tableHtml += '<tr>';
            fields.forEach(field => tableHtml += `<td>${user[field]}</td>`);
            tableHtml += `<td>
                <a href="/update-user?userId=${user._id}" class="btn">Update</a>
                <a href="/delete-user?userId=${user._id}" class="btn">Delete</a>
            </td></tr>`;
        });

        tableHtml += '</tbody></table>';

        res.send(tableHtml);
    } catch (err) {
        console.error('Error searching for user:', err);
        res.status(500).send('<h1>Server Error</h1><p>Unable to search for users.</p>');
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
