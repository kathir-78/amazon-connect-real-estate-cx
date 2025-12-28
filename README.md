
---
# Amazon Connect – Real-Estate Site Visit Slot Booking System

## 📌 Project Overview
This project implements a **Real-Estate Customer Interaction System** using **Amazon Connect**, **AWS Lambda**, and **DynamoDB**.

The IVR allows customers to:
- Enquire about plots
- Enquire about villas
- Ask about loan and legal documents
- Schedule a site visit (IVR-based slot booking)

**All enquiry-related options are directly routed to agents**, while **only site visit scheduling is handled through IVR, Lambda, and DynamoDB**.

---

## 🏗️ System Architecture
The solution is built using:

- Amazon Connect – IVR, menus, contact flows, CCP
- AWS Lambda – customer validation and slot logic
- Amazon DynamoDB – customer, slot, and booking data
- CloudWatch Logs – monitoring
- IAM – permissions



## ✨ Key Features
- Dynamic welcome prompt based on customer status
- Direct agent routing for enquiries
- IVR-based site visit slot booking
- Real-time slot availability check
- Booking confirmation via IVR
- Automatic call disconnect after scheduling

---

## 📞 Call Flow Logic

### 1️⃣ Incoming Call
- Customer calls the Amazon Connect number
- Phone number is passed to AWS Lambda

### 2️⃣ Customer Validation
Lambda checks:
- Whether the customer is new or existing
- Whether the customer is already scheduled for a site visit

Based on this:
- New customer → Standard welcome prompt
- Existing customer → Personalized welcome prompt

---

### 3️⃣ IVR Menu Options
Customer selects one of the following options:

| Option | Handling |
|------|--------|
| Plot Enquiries | Routed to Plot Agent Queue |
| Villa Enquiries | Routed to Villa Agent Queue |
| Loan & Legal Documents | Routed to Loan Support Agent |
| Default Support | Routed to Support Agent |
| Schedule Site Visit | IVR + Lambda-based flow |

---

### 4️⃣ Site Visit Slot Booking (IVR Only)
This flow is triggered **only when “Schedule Site Visit” is selected**.

Steps:
1. Lambda fetches available dates from DynamoDB
2. IVR announces available dates
3. Customer selects a date
4. Lambda fetches available time slots
5. IVR announces available time slots
6. Customer selects a slot

---

### 5️⃣ Booking Confirmation
- Lambda updates:
  - Customers table
  - Bookings table
  - AvailableSlots table
- Selected slot is marked as **booked**
- IVR plays confirmation message:
  > “You have successfully scheduled your site visit”
- Call is disconnected automatically

---

## 🧠 AWS Lambda Responsibilities
Lambda is used **only for site visit scheduling**, including:
- Customer existence validation
- Scheduled / not scheduled checks
- Fetching available dates
- Fetching available time slots
- Updating booking and slot status
- Setting Amazon Connect contact attributes

---

## 🗄️ DynamoDB Schema Design

### 🔹 Customers Table
| Attribute | Description |
|--------|------------|
| phoneNumber (PK) | Customer identifier |
| name | Customer name |

---

### 🔹 AvailableSlots Table
| Attribute | Description |
|---------|------------|
| slotDate (PK) | Available date |
| slotTime (SK) | Time slot |
| isAvailable | true / false |

---

### 🔹 Bookings Table
| Attribute | Description |
|---------|------------|
| phoneNumber (PK) | Customer number |
| slotDate | Booked date |
| slotTime | Booked time |
| status | booked / cancelled |

---
