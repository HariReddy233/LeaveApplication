# Database Setup for Country-Specific Holidays

## ✅ Database Tables (Already Exist)

The system automatically creates these tables. You don't need to create them manually, but here's what exists:

### 1. `holidays` Table (Country-Specific Holidays)
```sql
CREATE TABLE IF NOT EXISTS holidays (
  id SERIAL PRIMARY KEY,
  country_code VARCHAR(10) NOT NULL,
  holiday_date DATE NOT NULL,
  holiday_name VARCHAR(255) NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(country_code, holiday_date)
);
```

### 2. `organization_holidays` Table (All Users)
```sql
CREATE TABLE IF NOT EXISTS organization_holidays (
  id SERIAL PRIMARY KEY,
  holiday_name VARCHAR(255) NOT NULL,
  holiday_date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_year INTEGER NULL,
  created_by INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(holiday_date, recurring_year)
);
```

---

## 📋 What You Need to Do

### Step 1: Verify Users Have `country_code` Set

Check if your users have `country_code` set:

```sql
-- Check users without country_code
SELECT user_id, email, first_name, last_name, country_code, phone_number
FROM users
WHERE country_code IS NULL;

-- Update users based on their team/location
-- For US Team users:
UPDATE users 
SET country_code = 'US'
WHERE email LIKE '%@consultare.us%' 
   OR email IN ('user1@example.com', 'user2@example.com'); -- Add your US team emails

-- For India Team users:
UPDATE users 
SET country_code = 'IN'
WHERE email LIKE '%@consultare.in%' 
   OR email IN ('user3@example.com', 'user4@example.com'); -- Add your India team emails
```

### Step 2: Insert Country-Specific Holidays

#### For US Team Holidays:
```sql
-- US Holidays 2025
INSERT INTO holidays (country_code, holiday_date, holiday_name, is_active)
VALUES 
  ('US', '2025-01-01', 'New Year''s Day', true),
  ('US', '2025-01-20', 'Martin Luther King Jr. Day', true),
  ('US', '2025-02-17', 'Presidents'' Day', true),
  ('US', '2025-05-26', 'Memorial Day', true),
  ('US', '2025-07-04', 'Independence Day', true),
  ('US', '2025-09-01', 'Labor Day', true),
  ('US', '2025-10-13', 'Columbus Day', true),
  ('US', '2025-11-11', 'Veterans Day', true),
  ('US', '2025-11-27', 'Thanksgiving', true),
  ('US', '2025-12-25', 'Christmas', true)
ON CONFLICT (country_code, holiday_date) DO NOTHING;
```

#### For India Team Holidays:
```sql
-- India Holidays 2025
INSERT INTO holidays (country_code, holiday_date, holiday_name, is_active)
VALUES 
  ('IN', '2025-01-26', 'Republic Day', true),
  ('IN', '2025-03-29', 'Holi', true),
  ('IN', '2025-04-14', 'Ambedkar Jayanti', true),
  ('IN', '2025-04-17', 'Ram Navami', true),
  ('IN', '2025-05-01', 'Labour Day', true),
  ('IN', '2025-08-15', 'Independence Day', true),
  ('IN', '2025-08-26', 'Raksha Bandhan', true),
  ('IN', '2025-10-02', 'Gandhi Jayanti', true),
  ('IN', '2025-10-12', 'Dussehra', true),
  ('IN', '2025-10-31', 'Diwali', true),
  ('IN', '2025-11-01', 'Diwali', true),
  ('IN', '2025-12-25', 'Christmas', true)
ON CONFLICT (country_code, holiday_date) DO NOTHING;
```

### Step 3: Verify Holidays Are Created

```sql
-- Check US holidays
SELECT * FROM holidays WHERE country_code = 'US' ORDER BY holiday_date;

-- Check India holidays
SELECT * FROM holidays WHERE country_code = 'IN' ORDER BY holiday_date;

-- Check all holidays
SELECT country_code, holiday_date, holiday_name, is_active 
FROM holidays 
ORDER BY country_code, holiday_date;
```

### Step 4: Verify User Country Codes

```sql
-- Check which users have which country_code
SELECT 
  u.user_id,
  u.email,
  u.country_code,
  e.location,
  e.team,
  COUNT(*) OVER (PARTITION BY u.country_code) as users_in_country
FROM users u
LEFT JOIN employees e ON e.user_id = u.user_id
ORDER BY u.country_code, u.email;
```

---

## 🔍 How It Works

1. **Organization Holidays** (`organization_holidays` table):
   - Visible to ALL users
   - Created via UI: "Update Leave List" → "Organization Holidays" tab

2. **Country-Specific Holidays** (`holidays` table):
   - Visible ONLY to users with matching `country_code`
   - US holidays → only users with `country_code = 'US'`
   - India holidays → only users with `country_code = 'IN'`
   - Currently must be created via SQL (UI missing this feature)

3. **Employee Blocked Dates** (`employee_blocked_dates` table):
   - Visible only to specific employees
   - Created via UI: "Update Leave List" → "Employee Blocked Dates" tab

---

## ⚠️ Current Limitation

**The UI does NOT have an option to create country-specific holidays.**

The "Update Leave List" page only allows:
- ✅ Creating organization holidays (for all users)
- ✅ Creating employee-specific blocked dates
- ❌ **NOT** creating country-specific holidays (US/India)

**Workaround**: Use SQL queries above to insert country-specific holidays directly into the `holidays` table.

---

## 📝 Quick Reference

### Check if table exists:
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'holidays'
);
```

### Delete a holiday:
```sql
DELETE FROM holidays 
WHERE country_code = 'US' AND holiday_date = '2025-07-04';
```

### Update a holiday:
```sql
UPDATE holidays 
SET holiday_name = 'Updated Holiday Name', is_active = true
WHERE country_code = 'US' AND holiday_date = '2025-07-04';
```

### Deactivate a holiday (instead of deleting):
```sql
UPDATE holidays 
SET is_active = false
WHERE country_code = 'US' AND holiday_date = '2025-07-04';
```

---

## 🎯 Summary

**What exists in DB:**
- ✅ `holidays` table (auto-created)
- ✅ `organization_holidays` table (auto-created)
- ✅ `users.country_code` column (auto-created)

**What you need to do:**
1. ✅ Set `country_code = 'US'` or `'IN'` for your users
2. ✅ Insert country-specific holidays into `holidays` table using SQL above
3. ⚠️ UI enhancement needed: Add country selector to "Update Leave List" page (future feature)

**The system will automatically:**
- Filter holidays by user's `country_code` in calendar
- Show only relevant holidays to each team
- Block leave applications on country-specific holidays










