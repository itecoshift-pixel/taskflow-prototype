# SPF Pool Feature - For Pool Date, Queue Number & Collaboration Hub Notification

## Overview
Implemented automatic population of `for_pool_date` field and system message notification to collaboration hub when SPF request is approved by Sales Head. The feature ensures that when a manager clicks "Approve" on an SPF request, the `for_pool_date` is automatically set to the current timestamp, and a system message is sent to the collaboration hub across all three repositories (disruptive-product-database, taskflow-demo-v2, and engineer-ticketing).

## Changes Made

### 1. Manager SPF Update API
**File:** `pages/api/activity/manager/spf/update.ts`

#### Added Firebase Imports
```typescript
import { dbCollab } from "@/lib/firebase";
import { doc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
```

#### Updated for_pool_date and is_pool_finished Population
- When status changes to "Approved by Sales Head", `for_pool_date` is now automatically set to current timestamp
- `is_pool_finished` is set to `false` when approved (indicates pool process is not yet complete)
- Previously only `date_approved_sales_head` was being set
- Now all three fields are populated simultaneously: `date_approved_sales_head`, `for_pool_date`, and `is_pool_finished`

#### Added System Message to Collaboration Hub
After successful SPF approval, a system message is automatically sent to Firebase collaboration hub with:
- **Message Format:** `PROJECT STATUS: YOUR SPF PROJECT HAS BEEN SENT TO Product Development (PD) Department. Pool Date: {shanghaiTime} (Asia/Shanghai). You are currently on queue number [{queueNumber}].`
- **Queue Number Calculation:** The queue number is based on the position of the current SPF among all SPF requests with `is_pool_finished = FALSE`, ordered by `for_pool_date` (oldest first)
- **Timezone Conversion:** The `for_pool_date` is converted to Asia/Shanghai timezone
- **Firebase Collection:** Messages are sent to `spf_creations` collection using `spf_number` as document ID
- **Cross-Repository Visibility:** Since all three repositories share the same Firebase database, the message appears in collaboration hub across all repositories

### 2. TSA SPF Request Revision API
**File:** `pages/api/activity/tsa/spf/request-revision.ts`

#### Added Pool Date Reset on Revision
- When a revision is requested via the revision dialog, `for_pool_date` is updated to current timestamp
- `is_pool_finished` is set to `false` to indicate the pool process needs to be restarted
- This ensures that revised SPF requests re-enter the pool queue with a new pool date
- The update happens in the `spf_request` table when `edited_data` is provided
- System message is sent to collaboration hub with queue number, similar to approval flow

### 3. SPF Pool Queue Real-time Sync (Auto-Rebroadcast)
**File:** `pages/api/activity/spf/update-queue.ts`

#### Broadcast Updated Queue Numbers to All Active SPF Chats
To support real-time updates across all collaboration hubs, the system now automatically rebroadcasts updated queue positions to every SPF that is currently in the pool:
- **Active Pool Criteria:** `is_pool_finished = FALSE` and `for_pool_date IS NOT NULL`
- **Ordering:** `for_pool_date` ascending (oldest = queue number `[1]`)
- **Broadcast Target:** Firestore `spf_creations/{spf_number}` (messages appended via `arrayUnion`)
- **Message Format:** `PROJECT STATUS: YOUR SPF PROJECT HAS BEEN SENT TO Product Development (PD) Department. Pool Date: {shanghaiTime} (Asia/Shanghai). You are currently on queue number [{queueNumber}].`

#### Triggers
This broadcast endpoint is called automatically after:
- **Sales Head Approval** (`pages/api/activity/manager/spf/update.ts`)
- **Request Revision** (`pages/api/activity/tsa/spf/request-revision.ts`)

#### Why This Is Needed
Previously, only the SPF being approved/revised received the correct queue number at that moment. With this sync, when a new SPF enters the pool (or a revision resets `for_pool_date`), all other SPFs in the pool will also receive an updated queue number in their collaboration hub in near real-time.

## How It Works

### Approval Flow
1. **Manager clicks "Approve"** button in SPF dialog
2. **API receives PUT request** to `/api/activity/manager/spf/update`
3. **Status updated** to "Approved by Sales Head" in Supabase `spf_request` table
4. **Fields populated:**
   - `date_approved_sales_head` = current timestamp (ISO format)
   - `for_pool_date` = current timestamp (ISO format)
   - `is_pool_finished` = false (indicates pool process is not yet complete)
5. **Queue number calculated:**
   - Query all SPF requests with `is_pool_finished = FALSE`
   - Order by `for_pool_date` ascending (oldest first)
   - Find position of current SPF in the queue
6. **System message sent** to Firebase collaboration hub:
   - Converts `for_pool_date` to Asia/Shanghai timezone
   - Formats date as: "Month Day, Year at Hour:Minute AM/PM"
   - Includes queue number in the message
   - Sends to `spf_creations/{spf_number}` document in Firebase
7. **Queue sync broadcast** triggers automatically:
   - Calls `/api/activity/spf/update-queue` to rebroadcast updated queue numbers to all active SPFs in the pool
8. **Messages appear** in collaboration hub across all three repositories

### Revision Flow
1. **User clicks "Request Revision"** button in revision dialog
2. **API receives PUT request** to `/api/activity/tsa/spf/request-revision`
3. **Status updated** to "For Revision" in Supabase `spf_creation` table
4. **Fields updated in spf_request:**
   - `for_pool_date` = current timestamp (ISO format)
   - `is_pool_finished` = false (indicates pool process needs to restart)
   - Other edited fields from revision dialog
5. **Queue number calculated:**
   - Query all SPF requests with `is_pool_finished = FALSE`
   - Order by `for_pool_date` ascending (oldest first)
   - Find position of current SPF in the queue
6. **System message sent** to Firebase collaboration hub:
   - Converts new `for_pool_date` to Asia/Shanghai timezone
   - Formats date as: "Month Day, Year at Hour:Minute AM/PM"
   - Includes queue number in the message
   - Sends to `spf_creations/{spf_number}` document in Firebase
7. **Queue sync broadcast** triggers automatically:
   - Calls `/api/activity/spf/update-queue` to rebroadcast updated queue numbers to all active SPFs in the pool
8. **Messages appear** in collaboration hub across all three repositories

### Timezone Conversion
The `for_pool_date` is converted from ISO format to Asia/Shanghai timezone:
```typescript
const forPoolDate = new Date(data.for_pool_date || new Date());
const shanghaiTime = forPoolDate.toLocaleString("en-US", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true
});
```

**Example Output:** "June 4, 2026 at 10:30 AM"

### Queue Number Calculation
The queue number is calculated dynamically based on all SPF requests in the pool:
```typescript
const { data: queueData, error: queueError } = await supabase
    .from("spf_request")
    .select("id, for_pool_date")
    .eq("is_pool_finished", false)
    .order("for_pool_date", { ascending: true });

if (!queueError && queueData) {
    const currentIndex = queueData.findIndex(item => item.id === id);
    if (currentIndex !== -1) {
        queueNumber = currentIndex + 1;
    }
}
```

**Logic:**
1. Query all SPF requests where `is_pool_finished = FALSE`
2. Order results by `for_pool_date` in ascending order (oldest first)
3. Find the index of the current SPF in the sorted list
4. Add 1 to convert from 0-based index to 1-based queue number
5. If calculation fails, defaults to queue number 1

**Example:** If there are 5 SPF requests in the pool and the current one is the 3rd oldest, the queue number will be 3.

### Firebase Message Structure
```javascript
{
    id: "sys-1749999999999",
    text: "PROJECT STATUS: YOUR SPF PROJECT HAS BEEN SENT TO Product Development (PD) Department. Pool Date: June 4, 2026 at 10:30 AM (Asia/Shanghai). You are currently on queue number [3].",
    senderId: "system",
    senderName: "System",
    role: "system",
    time: "2026-06-04T02:30:00.000Z",
    isSystem: true,
    seenBy: []
}
```

## Database Schema Changes

### spf_request Table
**Column:** `for_pool_date`
- **Type:** `timestamp with time zone`
- **Purpose:** Stores the timestamp when SPF is approved and sent to Product Development
- **Populated:** Automatically when status becomes "Approved by Sales Head"

**Column:** `is_pool_finished`
- **Type:** `boolean`
- **Purpose:** Tracks whether the pool process is complete
- **Populated:** Set to `false` when status becomes "Approved by Sales Head" (indicates pool process is starting)
- **Note:** Will be set to `true` when Product Development completes the pool process

## Cross-Repository Integration

The system message is sent to Firebase's `spf_creations` collection, which is shared across:
1. **disruptive-product-database** - Product Development repository
2. **taskflow-demo-v2** - Sales/Manager repository
3. **engineer-ticketing** - Engineering repository

All three repositories listen to the same Firebase collection, ensuring the approval notification appears in all collaboration hubs simultaneously.

## Testing

### Manual Testing Steps
1. Navigate to `http://localhost:3001/roles/manager/activity/spf`
2. Open an SPF request with status "Pending for Procurement" or "Endorsed to Sales Head"
3. Click the "Approve" button in the SPF dialog
4. Verify the following:
   - Status changes to "Approved by Sales Head"
   - `for_pool_date` field is populated in Supabase (check database)
   - System message appears in collaboration hub
   - Message includes the pool date in Asia/Shanghai timezone
   - Message is visible across all three repositories

### Database Verification
```sql
SELECT id, spf_number, status, date_approved_sales_head, for_pool_date 
FROM spf_request 
WHERE status = 'Approved by Sales Head'
ORDER BY date_updated DESC;
```

### Firebase Verification
Check Firebase Console → Firestore Database → `spf_creations` collection → `{spf_number}` document → `messages` array

## Error Handling
- If Firebase document doesn't exist, it will be automatically created
- If Firebase message sending fails, the SPF approval still succeeds (error is logged but doesn't block the operation)
- This ensures the main approval workflow is not affected by Firebase issues

## Notes
- The `for_pool_date` is set to the same timestamp as `date_approved_sales_head`
- Asia/Shanghai timezone was chosen as it's the standard timezone for the organization's operations
- System messages are marked with `isSystem: true` for special styling in the collaboration hub
- The message uses `arrayUnion` to append to existing messages without overwriting
- Empty `seenBy` array ensures the message starts as unseen by all users
