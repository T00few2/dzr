export function formatNextSunday() {
    const today = new Date();
    const currentDayOfWeek = today.getDay(); // 0 (Sunday) to 6 (Saturday)
    
    // If today is Sunday, return today's date
    if (currentDayOfWeek === 0) {
      return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(today).replace(',', ''); // Remove the comma
    }
  
    // Otherwise, calculate the date of the next Sunday
    const daysUntilNextSunday = 7 - currentDayOfWeek;
    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilNextSunday);
    return new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' }).format(nextSunday).replace(',', ''); // Remove the comma
  }
  