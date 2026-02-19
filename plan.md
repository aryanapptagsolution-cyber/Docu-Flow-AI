

# Complete the AI Document Intelligence Platform

## Current State
The foundation is solid: authentication, dashboard layout, sidebar navigation, all 5 database tables with RLS, the `documents` storage bucket, the `process-document` edge function, and basic list pages for invoices, contracts, vendors, analytics, and alerts are all in place.

## What Needs to Be Built

### 1. Upload Page -- Editable Popup Flow
The upload page currently processes documents but does not show the editable popup when extraction completes.

**Changes to `UploadDocument.tsx`:**
- Add document type selector (Invoice or Contract) before upload
- After AI processing completes, automatically open a **Dialog/modal** pre-filled with extracted draft data
- Vendor field left **empty** with a combobox: dropdown of existing vendors + ability to type a new vendor name
- All extracted fields are editable (invoice number, dates, amounts, tax, items, summary)
- **Save** button: inserts final data into `invoice_data` or `contract_data`, creates vendor if new, updates document status to `"saved"`
- **Cancel** button: deletes uploaded file from storage, deletes the document record, closes popup

All save/cancel logic will be handled directly in the frontend using the Supabase client (no separate edge function needed since the user is authenticated and RLS covers access control).

### 2. Dashboard Home Enhancements
- Add a **Recent Uploads** section showing the last 5 documents with status badges
- Add quick action buttons for common tasks

### 3. Invoice Detail View
- Add a **View** button on each invoice row that opens a dialog showing all extracted data (items table, summary, confidence score, dates, amounts)
- Existing download button already works via signed URLs

### 4. Contracts -- Vendor Support
- The contracts page already lists contracts but the upload flow needs to support "contract" type
- Add parties display in the table

### 5. Reminder Edge Function (`send-reminders`)
- New edge function that queries invoices with `due_date` within 3 days and `payment_status = 'pending'`
- Sends reminder emails via **Resend** API
- Inserts alert records into the `alerts` table
- Configured to run daily via `pg_cron`
- **Requires**: Resend API key (will be requested as a secret)

### 6. Alerts Badge in Header
- Show unread alert count as a badge on the bell icon in the header

### 7. Professional Enhancements
- Confidence score indicator on popup and invoice detail
- Pagination on invoices and contracts tables

## Technical Details

### Files to Create
- `src/components/DocumentReviewDialog.tsx` -- the editable popup modal with vendor combobox, all fields, Save/Cancel
- `supabase/functions/send-reminders/index.ts` -- scheduled reminder edge function

### Files to Modify
- `src/pages/UploadDocument.tsx` -- add file type selector, poll for ready status, open review dialog
- `src/pages/DashboardHome.tsx` -- add recent uploads section
- `src/pages/Invoices.tsx` -- add view detail dialog, pagination
- `src/pages/Contracts.tsx` -- add pagination
- `src/components/DashboardHeader.tsx` -- add unread alerts badge count
- `supabase/config.toml` -- register `send-reminders` function

### Secrets Required
- **Resend API key** -- for sending reminder emails (will be requested before implementing the reminder function)

### Database Changes
- None needed -- all tables and columns already exist and support the required fields

