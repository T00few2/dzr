export function formatNextSaturday() {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 (Sunday) to 6 (Saturday)
    
    // If today is Thursday, return today's date
    if (currentDayOfWeek === 6) {
      return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(today).replace(',', ''); // Remove the comma
    }
  
    // Otherwise, calculate the date of the next Thursday
    const daysUntilNextSaturday = (6 - currentDayOfWeek + 7) % 7;
    const nextSaturday = new Date(today);
    nextSaturday.setDate(today.getDate() + daysUntilNextSaturday);
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(nextSaturday).replace(',', ''); // Remove the comma
  }
  