import { NextApiRequest, NextApiResponse } from 'next';
import { MongoClient } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { referenceid } = req.query;

  if (!referenceid) {
    return res.status(400).json({ error: 'Reference ID is required' });
  }

  try {
    // Connect to MongoDB
    const client = new MongoClient(process.env.MONGODB_URI || '', { maxPoolSize: 5, minPoolSize: 1, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000 });
    await client.connect();
    
    const db = client.db('taskflow');
    const usersCollection = db.collection('users');

    // Find user by referenceid
    const user = await usersCollection.findOne({ 
      referenceid: referenceid 
    });

    await client.close();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user data (excluding sensitive fields)
    const { _id, password, ...userData } = user;
    
    res.status(200).json(userData);
  } catch (error) {
    console.error('Error fetching user by referenceid:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
