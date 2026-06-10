import { NextApiRequest, NextApiResponse } from 'next';
import { supabase } from "@/utils/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { referenceid } = req.query;

  if (!referenceid) {
    return res.status(400).json({ error: 'Reference ID is required' });
  }

  try {
    // Find user by referenceid from Supabase
    const { data: user, error } = await supabase
      .from("users")
      .select("*")
      .eq("ReferenceID", referenceid)
      .single();

    if (error || !user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Return user data (excluding sensitive fields)
    const { Password, ...userData } = user;
    
    res.status(200).json(userData);
  } catch (error) {
    console.error('Error fetching user by referenceid from Supabase:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
