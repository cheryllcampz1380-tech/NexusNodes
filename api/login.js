import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    
    const { accessToken, username, referrerUsername } = req.body;

    if (!accessToken) {
        return res.status(401).json({ error: 'Missing access token' });
    }

    try {
        const piRes = await fetch('https://api.minepi.com/v2/me', {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (!piRes.ok) {
            return res.status(401).json({ error: 'Invalid Pi Access Token' });
        }

        const piUser = await piRes.json();
        const verifiedUsername = piUser.username || username;

        let { data: user } = await supabase
            .from('users')
            .select('*')
            .eq('pi_username', verifiedUsername)
            .single();

        if (user) return res.status(200).json(user);

        let { data: refUser } = await supabase
            .from('users')
            .select('id')
            .eq('pi_username', referrerUsername)
            .single();
            
        const rootId = refUser ? refUser.id : null;

        let parentId = null;
        let position = 1;

        if (rootId) {
            const spot = await findSpilloverSpot(rootId);
            parentId = spot.parentId;
            position = spot.position;
        }

        const { data: newUser, error } = await supabase.from('users').insert([{
            pi_username: verifiedUsername,
            parent_id: parentId,
            leg_position: position,
            current_level: 1,
            balance: 0
        }]).select().single();

        if (error) throw error;
        return res.status(200).json(newUser);

    } catch (err) { 
        return res.status(500).json({ error: err.message }); 
    }
}

async function findSpilloverSpot(startId) {
    let queue = [startId];
    while (queue.length > 0) {
        let currentId = queue.shift();
        for (let pos = 1; pos <= 3; pos++) {
            let { data: child } = await supabase
                .from('users')
                .select('id')
                .eq('parent_id', currentId)
                .eq('leg_position', pos)
                .single();
                
            if (!child) return { parentId: currentId, position: pos };
            queue.push(child.id);
        }
    }
}
