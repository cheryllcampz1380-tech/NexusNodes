import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
    const { username, referrerUsername } = req.body;

    try {
        let { data: user } = await supabase.from('users').select('*').eq('pi_username', username).single();
        if (user) return res.status(200).json(user);

        let { data: refUser } = await supabase.from('users').select('id').eq('pi_username', referrerUsername).single();
        const rootId = refUser ? refUser.id : null;

        let parentId = null;
        let position = 1;

        if (rootId) {
            const spot = await findSpilloverSpot(rootId);
            parentId = spot.parentId;
            position = spot.position;
        }

        const { data: newUser, error } = await supabase.from('users').insert([{
            pi_username: username,
            parent_id: parentId,
            leg_position: position,
            current_level: 1,
            balance: 0
        }]).select().single();

        if (error) throw error;
        return res.status(200).json(newUser);

    } catch (err) { res.status(500).json({ error: err.message }); }
}

async function findSpilloverSpot(startId) {
    let queue = [startId];
    while (queue.length > 0) {
        let currentId = queue.shift();
        for (let pos = 1; pos <= 3; pos++) {
            let { data: child } = await supabase.from('users').select('id').eq('parent_id', currentId).eq('leg_position', pos).single();
            if (!child) return { parentId: currentId, position: pos };
            queue.push(child.id);
        }
    }
}
