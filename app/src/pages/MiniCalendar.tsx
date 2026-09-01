const WEEKDAY_INITIALS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function buildWeeks(year: number, month: number): (number | null)[][] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function MiniCalendar({ today = new Date() }: { today?: Date }) {
  const year = today.getFullYear();
  const month = today.getMonth();
  const caption = today.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const weeks = buildWeeks(year, month);
  const currentDay = today.getDate();

  return (
    <table className="taleo-mini-calendar">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {WEEKDAY_INITIALS.map((initial, index) => (
            <th key={index} scope="col" abbr={initial}>
              {initial}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {weeks.map((week, weekIndex) => (
          <tr key={weekIndex}>
            {week.map((day, dayIndex) =>
              day === null ? (
                <td key={dayIndex} />
              ) : (
                <td
                  key={dayIndex}
                  className={day === currentDay ? 'is-today' : undefined}
                  aria-current={day === currentDay ? 'date' : undefined}
                >
                  {day}
                </td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
