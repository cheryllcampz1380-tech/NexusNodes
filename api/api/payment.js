import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const { action, paymentId, txid } = req.body;
    const apiKey = process.env.PI_NETWORK_API_KEY;

    try {
        if (action === 'approve') {
            const piRes = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/approve`, {
                method: 'POST',
                headers: { 'Authorization': `Key ${apiKey}` }
            });
            const data = await piRes.json();
            return res.status(200).json(data);
        }

        if (action === 'complete') {
            const piRes = await fetch(`https://api.minepi.com/v2/payments/${paymentId}/complete`, {
                method: 'POST',
                headers: { 
                    'Authorization': `Key ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ txid })
            });
            const data = await piRes.json();

            if (piRes.ok && data.metadata && data.metadata.username) {
                await supabase.rpc('increment_balance', { 
                    user_name: data.metadata.username, 
                    amount: data.amount 
                });
            }

            return res.status(200).json(data);
        }

        return res.status(400).json({ error: 'Invalid action' });
    } catch (err) {
        return res.status(500).json({ error: err.message });
    }
}
