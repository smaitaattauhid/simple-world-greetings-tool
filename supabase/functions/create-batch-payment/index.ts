
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Create batch payment function called");
    
    // Parse request body first to catch JSON parsing errors
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      throw new Error("Invalid JSON in request body");
    }
    
    const { orderIds, batchId, totalAmount } = requestBody;
    console.log("Parsed request:", { orderIds, batchId, totalAmount, orderIdsType: typeof orderIds, orderIdsLength: orderIds?.length });

    // Create Supabase client with anon key first
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Get user from auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }
    
    // Set the session for the client
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (authError) {
      console.error("Auth error:", authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    
    if (!user) {
      throw new Error("User not authenticated");
    }

    console.log("User authenticated:", user.id);

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      throw new Error("Invalid order IDs provided");
    }

    if (!batchId) {
      throw new Error("Batch ID is required");
    }

    // Use service role key for database operations to bypass RLS
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify all orders belong to the user and are pending payment
    const { data: orders, error: ordersError } = await supabaseService
      .from('orders')
      .select('*')
      .in('id', orderIds)
      .eq('user_id', user.id)
      .eq('payment_status', 'pending');

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      throw new Error(`Failed to fetch orders: ${ordersError.message}`);
    }

    console.log("Found orders:", orders?.length || 0, "out of", orderIds.length, "requested");
    console.log("Orders details:", orders);
    
    if (!orders || orders.length === 0) {
      throw new Error("No eligible orders found for batch payment");
    }

    // Calculate subtotal (original amount without existing admin fees)
    const subtotal = orders.reduce((sum, order) => {
      const originalAmount = order.total_amount - (order.admin_fee || 0);
      return sum + originalAmount;
    }, 0);

    // Calculate QRIS admin fee based on subtotal with updated 0.7% rate
    let adminFee = 0;
    if (subtotal < 628000) {
      adminFee = Math.round(subtotal * 0.007); // Updated to 0.7%
    } else {
      adminFee = 4400; // Fixed Rp 4,400
    }

    const totalWithAdminFee = subtotal + adminFee;
    
    console.log("Batch payment calculation:", {
      subtotal,
      adminFee,
      totalWithAdminFee,
      adminFeeType: subtotal < 628000 ? '0.7%' : 'Fixed Rp 4,400'
    });

    // Create Midtrans order ID with proper length validation
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 6);
    const midtransOrderId = `BATCH_${timestamp}_${randomSuffix}`.substr(0, 50);
    
    console.log("Creating Midtrans batch payment with order ID:", midtransOrderId);

    // Create batch payment with Midtrans
    const midtransServerKey = Deno.env.get("MIDTRANS_SERVER_KEY");
    if (!midtransServerKey) {
      throw new Error("Midtrans server key not configured");
    }

    // Prepare item details - individual orders plus admin fee
    const itemDetails = orders.map((order, index) => ({
      id: order.id.toString().substr(0, 50),
      price: Math.round(order.total_amount - (order.admin_fee || 0)), // Original amount without admin fee
      quantity: 1,
      name: `Pesanan ${order.child_name || `#${index + 1}`}`.substr(0, 50)
    }));

    // Add admin fee as separate line item
    if (adminFee > 0) {
      itemDetails.push({
        id: 'qris_admin_fee_batch',
        price: adminFee,
        quantity: 1,
        name: `Biaya Admin QRIS Batch (${subtotal < 628000 ? '0,7%' : 'Tetap Rp 4.400'})`
      });
    }

    // Prepare Midtrans request payload
    const midtransPayload = {
      transaction_details: {
        order_id: midtransOrderId,
        gross_amount: Math.round(totalWithAdminFee)
      },
      customer_details: {
        email: user.email || "customer@example.com",
        first_name: user.user_metadata?.full_name || "Customer"
      },
      item_details: itemDetails,
      enabled_payments: ["qris"], // QRIS only
      payment_type: "qris",
      qris: {
        acquirer: "gopay"
      },
      custom_expiry: {
        expiry_duration: 15,
        unit: "minute"
      },
      custom_field1: 'qris_batch_payment',
      custom_field2: `batch_${batchId}`,
      custom_field3: `admin_fee_${adminFee}`,
      callbacks: {
        finish: `${req.headers.get("origin") || "https://your-domain.com"}/orders`
      }
    };

    console.log("Midtrans payload:", JSON.stringify(midtransPayload, null, 2));

    // Call Midtrans Snap API
    let midtransResponse;
    try {
      midtransResponse = await fetch("https://app.sandbox.midtrans.com/snap/v1/transactions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
          "Authorization": `Basic ${btoa(midtransServerKey + ":")}`
        },
        body: JSON.stringify(midtransPayload)
      });
    } catch (fetchError) {
      console.error("Error calling Midtrans API:", fetchError);
      throw new Error(`Failed to connect to Midtrans: ${fetchError.message}`);
    }

    if (!midtransResponse.ok) {
      const errorText = await midtransResponse.text();
      console.error("Midtrans API error response:", errorText);
      console.error("Midtrans API status:", midtransResponse.status);
      throw new Error(`Midtrans API error: ${midtransResponse.status} - ${errorText}`);
    }

    let midtransData;
    try {
      midtransData = await midtransResponse.json();
    } catch (jsonError) {
      console.error("Error parsing Midtrans response:", jsonError);
      throw new Error("Invalid response from Midtrans API");
    }

    console.log("Midtrans response:", midtransData);

    if (!midtransData.token) {
      console.error("No snap token in Midtrans response:", midtransData);
      throw new Error("No snap token received from Midtrans");
    }

    // Update orders with Midtrans data and new total including admin fee
    const foundOrderIds = orders.map(order => order.id);
    const { error: updateError } = await supabaseService
      .from('orders')
      .update({
        midtrans_order_id: midtransOrderId,
        snap_token: midtransData.token,
        admin_fee: Math.round(adminFee / orders.length), // Distribute admin fee across orders
        total_amount: Math.round((subtotal + adminFee) / orders.length), // Update with proportional total including admin fee
        updated_at: new Date().toISOString()
      })
      .in('id', foundOrderIds);

    if (updateError) {
      console.error("Error updating orders:", updateError);
      throw new Error(`Failed to update orders with payment information: ${updateError.message}`);
    }

    // Create batch_orders entries
    const batchOrdersData = foundOrderIds.map(orderId => ({
      batch_id: batchId,
      order_id: orderId
    }));

    const { error: batchError } = await supabaseService
      .from('batch_orders')
      .insert(batchOrdersData);

    if (batchError) {
      console.error("Error creating batch orders:", batchError);
      // This is not critical, we can still proceed with payment
      console.log("Continuing despite batch_orders error");
    }

    console.log("Batch payment created successfully");

    return new Response(JSON.stringify({
      success: true,
      snap_token: midtransData.token,
      order_id: midtransOrderId,
      batch_id: batchId,
      total_amount: totalWithAdminFee,
      admin_fee: adminFee,
      subtotal: subtotal,
      processed_orders: foundOrderIds.length,
      total_requested: orderIds.length
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    console.error("Batch payment error:", error);
    console.error("Error stack:", error.stack);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: error.stack
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
