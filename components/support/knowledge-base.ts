// ─── Support Knowledge Base ───────────────────────────────────────────────────
// Q&A content keyed by ticket subject (matches TICKET_SUBJECTS values)

export interface QAItem {
  question: string;
  answer: string;
}

export interface KnowledgeEntry {
  summary: string;   // Brief description shown before Q&A list
  steps?: string[];  // Step-by-step resolution steps (optional)
  qa: QAItem[];
}

const KB: Record<string, KnowledgeEntry> = {

  // ─── TASKFLOW ─────────────────────────────────────────────────────────────

  "Add/Request Item Code": {
    summary: "To request a new item code, you need to provide the product details to the IT team.",
    steps: [
      "Prepare the product name, description, unit of measure, and pricing.",
      "Fill out the Item Code Request Form (ask your TSM for the form link).",
      "Submit the completed form via this support ticket.",
      "IT will process within 1–3 business days.",
    ],
    qa: [
      { question: "How long does it take to add a new item code?", answer: "Processing typically takes 1–3 business days after complete information is submitted." },
      { question: "What information is required?", answer: "Product name, description, unit of measure, pricing, and supplier details are required." },
    ],
  },

  "Reset Password / Unable to Login": {
    summary: "If you cannot log in or need to reset your password, follow these steps first.",
    steps: [
      "Make sure you are using the correct email address registered to your account.",
      "Click 'Forgot Password' on the login page.",
      "Check your email inbox (including spam/junk folder) for the reset link.",
      "The link expires in 30 minutes — request a new one if needed.",
      "If the issue persists after following these steps, submit a ticket below.",
    ],
    qa: [
      { question: "I didn't receive the password reset email.", answer: "Check your spam/junk folder. If still not found, wait 5 minutes and try again. Ensure you're using the registered email address." },
      { question: "My account says it's locked.", answer: "Accounts lock after 5 consecutive failed login attempts. Wait 15 minutes before trying again, or submit an Account Locked ticket." },
      { question: "I can log in but the page doesn't load.", answer: "Try clearing your browser cache (Ctrl+Shift+Delete) and refreshing. Try a different browser or incognito mode." },
    ],
  },

  "Account Locked": {
    summary: "Accounts automatically lock after multiple failed login attempts. Here's how to resolve it.",
    steps: [
      "Wait 15 minutes — accounts auto-unlock after a timeout period.",
      "Try logging in again with the correct credentials.",
      "If still locked, submit a ticket and IT will manually unlock your account.",
    ],
    qa: [
      { question: "How many failed attempts trigger a lockout?", answer: "5 consecutive failed login attempts will lock an account." },
      { question: "How long does the lockout last?", answer: "Lockout automatically clears after 15–30 minutes." },
    ],
  },

  "Unable to Access / Load": {
    summary: "If the application is not loading or returning errors, try these steps first.",
    steps: [
      "Check your internet connection — try opening another website.",
      "Hard-refresh the page: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac).",
      "Clear browser cache: Ctrl+Shift+Delete → Clear cached images and files.",
      "Try a different browser (Chrome recommended).",
      "Try incognito/private mode.",
      "If issue persists, note the exact error message and submit a ticket.",
    ],
    qa: [
      { question: "The page shows a blank screen.", answer: "This is often a cache issue. Try hard-refresh (Ctrl+Shift+R) or clear cache and reload." },
      { question: "I see a 403 or 404 error.", answer: "Your account may not have access to that page. Check with your TSM if the URL is correct." },
      { question: "Works on mobile but not desktop (or vice versa).", answer: "Try clearing the browser cache on the failing device. If it only affects one browser, try Chrome." },
    ],
  },

  "Slow Loading / Glitch": {
    summary: "Performance issues are often temporary. Try these steps before submitting a ticket.",
    steps: [
      "Check your internet speed at fast.com or speedtest.net.",
      "Close unused browser tabs and applications.",
      "Clear browser cache and reload.",
      "Try during off-peak hours (early morning).",
      "If consistently slow over multiple days, submit a ticket with your internet speed result.",
    ],
    qa: [
      { question: "The app is slow only at certain times.", answer: "Peak hours (9AM–12PM and 1PM–5PM) may cause slower response times. If it's consistently slow, submit a ticket." },
      { question: "Pages glitch or display incorrectly.", answer: "Clear your browser cache (Ctrl+Shift+Delete) and reload. If it continues, try a different browser." },
    ],
  },

  "Quotation Creation - Problem / Error / Page Break / Price not Tally / Wrong Computation": {
    summary: "Quotation issues can often be resolved by checking these common causes.",
    steps: [
      "Verify that all item codes are active and have correct pricing in the system.",
      "Check if the discount percentage or special pricing is correctly applied.",
      "For page break issues, try reducing the number of line items or adjusting the display mode.",
      "If amounts don't tally, check if VAT-inclusive/exclusive is set correctly.",
      "Screenshot the error and note which quotation number is affected before submitting.",
    ],
    qa: [
      { question: "Why does the total not match my calculation?", answer: "Check if VAT (12%) is included or excluded in the displayed price. Verify discounts are applied correctly." },
      { question: "The PDF cuts off content.", answer: "This is a page break issue. Try reducing items per page or using 'Landscape' orientation. Contact IT if it persists." },
      { question: "Quotation number was generated but the form is blank.", answer: "This is a generation error. Note the quotation number and submit a Quotation Number Generation Error ticket." },
    ],
  },

  "PDF Download Issue": {
    summary: "If you cannot download PDFs, try these steps first.",
    steps: [
      "Ensure your browser allows pop-ups from the site — click the pop-up blocked icon in the address bar.",
      "Try right-clicking the download button and selecting 'Save link as...'",
      "Try a different browser (Chrome or Edge recommended).",
      "Disable any PDF viewer extensions temporarily.",
    ],
    qa: [
      { question: "The PDF opens blank.", answer: "This is usually a browser PDF renderer issue. Right-click the download button → Save as → open with Adobe Reader instead of browser." },
      { question: "Download button does nothing.", answer: "Your browser may be blocking pop-ups. Click the pop-up blocked icon in the address bar and allow the download." },
    ],
  },

  "Activity Duplication": {
    summary: "Duplicate activities can appear due to double-submissions or sync issues.",
    steps: [
      "First verify it is indeed a duplicate — check the date, time, and content of both entries.",
      "Do NOT delete both — only the duplicate copy should be removed.",
      "Note the activity reference numbers of both entries before submitting.",
    ],
    qa: [
      { question: "How do I know which one is the duplicate?", answer: "The original is typically the one with the earlier timestamp. Keep the original and request deletion of the duplicate." },
      { question: "Can I delete it myself?", answer: "Direct deletion requires admin approval. Submit an Activity Request for Deletion ticket with the reference number." },
    ],
  },

  // ─── EMAIL ────────────────────────────────────────────────────────────────

  "Unable / Not Working to Send Email": {
    summary: "Email sending issues are often related to authentication or quota limits.",
    steps: [
      "Check if you can receive emails — if not, the issue may be with your account credentials.",
      "Verify the recipient email address is correct (no typos).",
      "Check your Sent folder — the email may have sent but not shown as delivered.",
      "Check if you've reached your daily sending limit (500 emails/day for Google Workspace).",
      "Try logging out and back in to your email account.",
    ],
    qa: [
      { question: "Email goes to Drafts instead of Sent.", answer: "This usually means the email failed to send. Check your internet connection and try again." },
      { question: "Recipients say they're not receiving my emails.", answer: "Ask them to check their spam folder. Your domain may need SPF/DKIM configuration — submit a ticket." },
    ],
  },

  "Unable / Not Working to Login": {
    summary: "For email login issues, try these steps before submitting a ticket.",
    steps: [
      "Verify you're using the correct email address (company email, not personal).",
      "Try resetting your password via the 'Forgot Password' option.",
      "Check if your account has been suspended (contact your admin).",
      "Clear browser cookies and try again.",
      "Try accessing from mail.google.com directly if using Gmail/Workspace.",
    ],
    qa: [
      { question: "I get 'Invalid credentials' but password is correct.", answer: "Your password may have been reset by an admin. Try 'Forgot Password' or contact IT to reset your email password." },
      { question: "Account says suspended.", answer: "Suspended accounts need admin intervention. Submit a ticket with your email address and IT will investigate." },
    ],
  },

  "Storage Full": {
    summary: "When email storage is full, you can no longer send or receive emails.",
    steps: [
      "Delete large emails with attachments from your inbox and sent folder.",
      "Empty the Trash folder (emails in trash still count toward storage).",
      "Use Google Takeout or Outlook export to archive old emails locally.",
      "Request a storage upgrade through this support ticket if you need more space.",
    ],
    qa: [
      { question: "How much storage do I have?", answer: "Check Settings → About or Storage in your email client. Google Workspace standard accounts have 30GB." },
      { question: "I deleted emails but storage didn't decrease.", answer: "Empty your Trash folder — deleted emails remain until trash is emptied. Go to Trash → Empty Trash." },
    ],
  },

  // ─── NETWORK ──────────────────────────────────────────────────────────────

  "No Internet Connection": {
    summary: "Before submitting a ticket, try these basic troubleshooting steps.",
    steps: [
      "Check if other devices can connect — if yes, the issue is with your device.",
      "Try unplugging your router/modem for 30 seconds, then plug back in.",
      "Restart your device's WiFi adapter (turn off and on).",
      "Check if the LAN cable is securely connected (if using wired connection).",
      "Check if the ISP LOS (Loss of Signal) indicator is lit on your router.",
    ],
    qa: [
      { question: "Other devices are connected but mine isn't.", answer: "Try forgetting and reconnecting to the WiFi network. If on LAN, try a different cable or port." },
      { question: "The router is on but internet is down.", answer: "Check the router's WAN/Internet light. If it's red or off, the issue is with the ISP. Submit a ticket for ISP coordination." },
    ],
  },

  "Internet Unstable / Slow": {
    summary: "Slow or unstable internet can have multiple causes. Try these steps first.",
    steps: [
      "Run a speed test at fast.com and note the results.",
      "Move closer to the WiFi router if using wireless.",
      "Disconnect devices not in use to free up bandwidth.",
      "Restart the router (unplug for 30 seconds).",
      "Check if speed improves on a wired connection (LAN cable).",
      "Include your speed test results when submitting a ticket.",
    ],
    qa: [
      { question: "Speed is slow only at certain times of day.", answer: "This may be peak usage. Try at off-peak hours. If consistently slow, submit a ticket with speed test results." },
      { question: "Video calls keep dropping.", answer: "Video calls need at least 3Mbps upload. Run a speed test and check upload speed specifically." },
    ],
  },

  // ─── DEVICE PRINTER ──────────────────────────────────────────────────────

  "Unable to Print": {
    summary: "Printing issues are usually connectivity or driver related. Try these steps.",
    steps: [
      "Check if the printer is powered on and has paper loaded.",
      "Verify the printer is connected (USB or network) and shows as 'Online' on your computer.",
      "Try clearing the print queue: Settings → Printers → Open Queue → Cancel all documents.",
      "Restart both the printer and your computer.",
      "Try printing a test page from Printer Properties.",
    ],
    qa: [
      { question: "Print job is stuck in queue.", answer: "Cancel all pending jobs from the print queue. Restart the Print Spooler service (Windows: Services → Print Spooler → Restart)." },
      { question: "Printer shows Offline.", answer: "Right-click the printer → See what's printing → Printer menu → Uncheck 'Use Printer Offline'. Also check the network/USB connection." },
    ],
  },

  "Paper Jam": {
    summary: "Paper jams need to be cleared carefully to avoid damaging the printer.",
    steps: [
      "Turn off the printer before removing jammed paper.",
      "Open all access doors and gently pull out jammed paper — do NOT rip it.",
      "Check inside rollers for small torn pieces of paper.",
      "Fan the paper stack before loading to prevent future jams.",
      "Reload paper — make sure it is aligned and not overfilled.",
    ],
    qa: [
      { question: "Paper jams repeatedly with the same paper.", answer: "The paper may be too thick, too thin, or damp. Use the recommended paper weight (usually 75-90gsm)." },
      { question: "Jammed paper tore and pieces are stuck inside.", answer: "Do not force it out. Submit a ticket for hardware assistance — forcing it can damage the rollers." },
    ],
  },

  // ─── DEVICE LAPTOP ───────────────────────────────────────────────────────

  "Lagging / Slow": {
    summary: "Laptop performance issues can often be improved without hardware replacement.",
    steps: [
      "Close programs not in use and check Task Manager for high CPU/memory usage.",
      "Restart the laptop — a fresh boot clears memory.",
      "Check if Windows Update is running in the background (can cause slowdowns).",
      "Run Disk Cleanup (Windows) to free up storage space.",
      "Check if antivirus is doing a full scan.",
    ],
    qa: [
      { question: "Laptop is slow only when running specific apps.", answer: "The app may need more RAM or CPU than available. Check Task Manager (Ctrl+Shift+Esc) while the app is running." },
      { question: "Slow after Windows update.", answer: "Windows may still be completing background update tasks. Give it 30-60 minutes. If still slow after restart, submit a ticket." },
    ],
  },

  "Overheat": {
    summary: "Overheating reduces performance and can cause hardware damage. Act quickly.",
    steps: [
      "Immediately place the laptop on a hard flat surface — not fabric/pillows which block vents.",
      "Close heavy applications like video editing software or games.",
      "Clean the vents with compressed air if dusty.",
      "Use a laptop cooling pad.",
      "Check if the fan is spinning — if not, submit a ticket immediately.",
    ],
    qa: [
      { question: "Laptop shuts down by itself.", answer: "This is thermal protection triggering. The laptop is overheating. Let it cool for 30 minutes before restarting. Submit a ticket if it recurs." },
      { question: "Fan is loud and laptop is hot.", answer: "The fan is working but struggling. Check that vents are not blocked. Clean vents if dusty. Submit a ticket for cleaning service." },
    ],
  },

};

export default KB;

// Helper: get knowledge entry for a subject (handles [Category] prefix)
export function getKnowledge(subject: string): KnowledgeEntry | null {
  // Strip [Category] prefix if present
  const cleaned = subject.replace(/^\[[^\]]+\]\s*/, "").trim();
  return KB[cleaned] ?? null;
}
