// jQuery event handler for ask-question button
$(document).ready(function() {
  // Handle click on any button with class 'ask-question'
  $(document).on('click', '.ask-question', function(e) {
    e.preventDefault();
    
    // Call the /postQuestion API endpoint
    $.ajax({
      url: 'http://localhost:3000/postQuestion',
      type: 'POST',
      contentType: 'application/json',
      data: JSON.stringify({
        timestamp: new Date().toISOString(),
        buttonId: $(this).attr('id')
      }),
      success: function(response) {
        console.log('Question posted successfully:', response);
      },
      error: function(xhr, status, error) {
        console.error('Error posting question:', error);
      }
    });
  });
});

