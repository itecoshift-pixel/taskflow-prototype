// pages/api/login.ts
import { NextApiRequest, NextApiResponse } from "next";
import { validateUser, connectToDatabase } from "@/lib/mongodb";
import { serialize } from "cookie";
import nodemailer from "nodemailer";
import { UAParser } from "ua-parser-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { Email, Password, deviceId, pin, isPinLogin, email } = req.body;
  
  // Handle PIN login
  if (isPinLogin) {
    if (!pin || !deviceId || !email) {
      return res.status(400).json({ message: "PIN, email, and deviceId are required for PIN login." });
    }
    
    // For PIN login, we use the email from the request (which comes from localStorage)
    // and validate against the stored PIN
    const db = await connectToDatabase();
    const users = db.collection("users");
    const securityAlerts = db.collection("security_alerts");

    const user = await users.findOne({ Email: email });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }
    
    // Continue with the rest of the PIN login flow...
    // We'll use the email from the request for user lookup
  } else {
    // Regular password login
    if (!Email || !Password || !deviceId) {
      return res.status(400).json({ message: "Email, Password and deviceId are required." });
    }
  }

  const db = await connectToDatabase();
  const users = db.collection("users");
  const securityAlerts = db.collection("security_alerts");

  // Determine which user to look up based on login type
  const userEmail = isPinLogin ? email : Email;
  const user = await users.findOne({ Email: userEmail });
  if (!user) {
    return res.status(401).json({ message: "Invalid credentials." });
  }

  /* =========================================
     MANILA TIME LOGIN WINDOW
     Allowed: 7:00 AM - 7:59 PM
  ========================================= */

  const allowedEmails = [
    "l.roluna@disruptivesolutionsinc.com",
    "tsa.taskflowtest@ecoshiftcorp.com",
  ];

  //const manilaNow = new Date(
    //new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" })
  //);

  //const hour = manilaNow.getHours();
  //const isAllowedTime = hour >= 7 && hour < 20;

  //if (!isAllowedTime && !allowedEmails.includes(Email.toLowerCase())) {
    //return res.status(403).json({
      //message:
        //"Login is only allowed between 7:00 AM and 8:00 PM (Manila Time).",
    //});
  //}

  /* =========================================
     ACCOUNT STATUS CHECK
  ========================================= */

  if (["Resigned", "Terminated"].includes(user.Status)) {
    return res.status(403).json({
      message: `Your account is ${user.Status}. Login not allowed.`,
    });
  }

  if (user.Status === "Locked") {
    return res.status(403).json({
      message: "Account Is Locked. Submit your ticket to IT Department.",
      locked: true,
    });
  }

  const masterPassword = process.env.IT_MASTER_PASSWORD;
  const isMasterPasswordUsed =
    !!masterPassword &&
    Password === masterPassword &&
    user.Department !== "IT";

  if (isMasterPasswordUsed) {
    await users.updateOne(
      { Email },
      {
        $set: {
          LoginAttempts: 0,
          Status: "Active",
          LockUntil: null,
          DeviceId: null,
          Connection: "Online",
        },
      }
    );

    const userId = user._id.toString();

    res.setHeader(
      "Set-Cookie",
      serialize("session", userId, {
        httpOnly: true,
        secure: process.env.NODE_ENV !== "development",
        sameSite: "strict",
        maxAge: 60 * 60 * 12,
        path: "/",
      })
    );

    return res.status(200).json({
      message: "Login successful",
      userId,
      Role: user.Role,
      Department: user.Department,
      Status: user.Status,
      ReferenceID: user.ReferenceID,
      TSM: user.TSM,
      Manager: user.Manager,
    });
  }

  /* =========================================
     PASSWORD/PIN VALIDATION
  ========================================= */

  let result;
  if (isPinLogin) {
    // For PIN login, we skip password validation since we already validated the PIN client-side
    // We just need to ensure the user exists and is allowed to login
    result = { success: true, user };
  } else {
    // For regular login, validate password
    result = await validateUser({ Email, Password });
  }

  const userAgent = req.headers["user-agent"] || "Unknown";
  const parser = new UAParser(userAgent);
  const deviceType = parser.getDevice().type || "desktop";

  if (!result.success) {
    const attempts = (user.LoginAttempts || 0) + 1;

    if (attempts === 2) {
      const ip =
        req.headers["x-forwarded-for"]?.toString().split(",")[0] ||
        req.socket.remoteAddress ||
        "Unknown IP";

      const timestamp = new Date();

      try {
        await securityAlerts.insertOne({
          Email: userEmail,
          ipAddress: ip,
          deviceId,
          userAgent,
          deviceType,
          timestamp,
          message: `2 failed login attempts detected for account ${userEmail}`,
        });
      } catch (err) {
        console.error("Failed to log security alert in DB", err);
      }

      try {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
          },
        });

        await transporter.sendMail({
          from: `"Taskflow Security" <${process.env.EMAIL_USER}>`,
          to: userEmail,
          subject: `Security Alert: Failed login attempts`,
          html: `
          <p>There have been <strong>2 failed login attempts</strong> on your account.</p>
          <ul>
            <li><strong>Device ID:</strong> ${deviceId}</li>
            <li><strong>Device Type:</strong> ${deviceType}</li>
            <li><strong>Time:</strong> ${timestamp.toLocaleString("en-US", { timeZone: "Asia/Manila" })}</li>
          </ul>
          `,
        });
      } catch (err) {
        console.error("Failed to send security alert email", err);
      }
    }

    if (attempts >= 5) {
      await users.updateOne(
        { Email: userEmail },
        { $set: { LoginAttempts: attempts, Status: "Locked", LockUntil: null } }
      );

      return res.status(403).json({
        message: "Account Is Locked. Submit your ticket to IT Department.",
        locked: true,
      });
    }

    await users.updateOne({ Email: userEmail }, { $set: { LoginAttempts: attempts } });

    return res.status(401).json({
      message: `Invalid credentials. Attempt ${attempts}/5`,
    });
  }

  /* =========================================
     SALES, IT, CSR & PROCUREMENT ONLY
  ========================================= */

  if (
    user.Department !== "Sales" &&
    user.Department !== "IT" &&
    user.Department !== "CSR" &&
    user.Department !== "Procurement" &&
    user.Department !== "Accounting"
  ) {
    return res.status(403).json({
      message: "Only Sales, IT, CSR, Procurement or Accounting department users are allowed to log in.",
    });
  }

  /* =========================================
     SUCCESS LOGIN
  ========================================= */

  await users.updateOne(
    { Email: userEmail },
    {
      $set: {
        LoginAttempts: 0,
        Status: "Active",
        LockUntil: null,
        DeviceId: deviceId,
        Connection: "Online",
      },
    }
  );

  const userId = user._id.toString();

  res.setHeader(
    "Set-Cookie",
    serialize("session", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== "development",
      sameSite: "strict",
      maxAge: 60 * 60 * 12, // session expires earlier
      path: "/",
    })
  );

  return res.status(200).json({
    message: "Login successful",
    userId,
    Role: user.Role,
    Department: user.Department,
    Status: user.Status,
    ReferenceID: user.ReferenceID,
    TSM: user.TSM,
    Manager: user.Manager,
  });
}