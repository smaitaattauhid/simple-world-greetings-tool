
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, amount, customerDetails, itemDetails, paymentMethod } = await req.json()
    
    console.log('create-payment: Processing QRIS payment for order:', orderId, 'amount:', amount)
    console.log('create-payment: Item details received:', itemDetails)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Verify order exists
    console.log('create-payment: Verifying order exists with midtrans_order_id:', orderId)
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select('id, total_amount, payment_status, admin_fee')
      .eq('midtrans_order_id', orderId)
      .single()

    if (orderError) {
      console.error('create-payment: Order verification error:', orderError)
      return new Response(
        JSON.stringify({ error: 'Order not found', details: orderError.message }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log('create-payment: Order found:', orderData)

    // Get Midtrans credentials
    const midtransServerKey = Deno.env.get('MIDTRANS_SERVER_KEY')
    if (!midtransServerKey) {
      throw new Error('Midtrans server key not configured')
    }

    const auth = btoa(`${midtransServerKey}:`)
    
    // Calculate admin fee using QRIS rules with updated 0.7% rate
    const subtotal = amount - (orderData.admin_fee || 0)
    let adminFee = 0
    
    if (subtotal < 628000) {
      adminFee = Math.round(subtotal * 0.007) // Updated to 0.7%
    } else {
      adminFee = 4400 // Fixed Rp 4,400
    }

    console.log('create-payment: Calculated QRIS admin fee:', adminFee, 'for subtotal:', subtotal)

    // Ensure we have proper item details with admin fee included
    const finalItemDetails = [...itemDetails]
    
    // Add admin fee as separate line item if applicable
    if (adminFee > 0) {
      finalItemDetails.push({
        id: 'qris_admin_fee',
        price: adminFee,
        quantity: 1,
        name: `Biaya Admin QRIS (${subtotal < 628000 ? '0,7%' : 'Tetap Rp 4.400'})`
      })
    }

    // Verify total amount matches
    const calculatedTotal = finalItemDetails.reduce((sum, item) => sum + (item.price * item.quantity), 0)
    console.log('create-payment: Calculated total from items:', calculatedTotal, 'Expected:', amount)

    // QRIS-only Midtrans configuration
    const midtransPayload = {
      transaction_details: {
        order_id: orderId,
        gross_amount: calculatedTotal // Use calculated total to ensure accuracy
      },
      customer_details: customerDetails,
      item_details: finalItemDetails,
      enabled_payments: ["qris"], // QRIS only
      payment_type: "qris", // Force QRIS
      qris: {
        acquirer: "gopay" // Use GoPay as QRIS acquirer
      },
      custom_expiry: {
        expiry_duration: 15,
        unit: "minute"
      },
      custom_field1: paymentMethod || 'qris',
      custom_field2: 'qris_only_payment',
      custom_field3: `admin_fee_${adminFee}`
    }

    console.log('create-payment: Creating QRIS-only Midtrans transaction:', JSON.stringify(midtransPayload, null, 2))

    const midtransResponse = await fetch('https://app.sandbox.midtrans.com/snap/v1/transactions', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify(midtransPayload)
    })

    const responseText = await midtransResponse.text()
    console.log('create-payment: Midtrans raw response:', responseText)

    if (!midtransResponse.ok) {
      console.error('create-payment: Midtrans QRIS error:', responseText)
      
      // Try to parse error for better debugging
      let errorDetail = responseText
      try {
        const errorJson = JSON.parse(responseText)
        errorDetail = errorJson.error_messages ? errorJson.error_messages.join(', ') : errorJson.message || responseText
      } catch (e) {
        // Keep original text if can't parse
      }
      
      throw new Error(`Midtrans QRIS error: ${midtransResponse.status} - ${errorDetail}`)
    }

    let midtransData
    try {
      midtransData = JSON.parse(responseText)
    } catch (e) {
      throw new Error('Invalid JSON response from Midtrans')
    }

    console.log('create-payment: Midtrans QRIS success response:', midtransData)

    // Update order with snap token
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        snap_token: midtransData.token,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderData.id)

    if (updateError) {
      console.error('create-payment: Failed to update order with snap token:', updateError)
      // Don't fail the request, just log
    }

    return new Response(
      JSON.stringify({ 
        snap_token: midtransData.token,
        redirect_url: midtransData.redirect_url,
        payment_method: 'qris',
        order_id: orderId,
        amount: calculatedTotal,
        admin_fee: adminFee
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('create-payment: QRIS Error:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Gagal membuat pembayaran QRIS. Silakan coba lagi.'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
