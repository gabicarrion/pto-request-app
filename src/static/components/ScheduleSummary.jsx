import React from 'react';
import { format } from 'date-fns';
import Button from '@atlaskit/button';

const ScheduleSummary = ({ schedules, onEdit }) => {
  const calculateTotalDays = () => {
    let fullDays = 0;
    let halfDays = 0;

    schedules.forEach(schedule => {
      if (schedule.type === 'FULL_DAY') {
        fullDays += 1;
      } else {
        halfDays += 1;
      }
    });

    return {
      fullDays,
      halfDays,
      total: fullDays + (halfDays * 0.5)
    };
  };

  const groupByType = () => {
    return schedules.reduce((acc, schedule) => {
      if (!acc[schedule.type]) {
        acc[schedule.type] = [];
      }
      acc[schedule.type].push(schedule);
      return acc;
    }, {});
  };

  const getTypeLabel = (type) => {
    switch (type) {
      case 'FULL_DAY': return 'Full Days';
      case 'HALF_DAY_MORNING': return 'Morning Half Days';
      case 'HALF_DAY_AFTERNOON': return 'Afternoon Half Days';
      default: return type;
    }
  };

  const { fullDays, halfDays, total } = calculateTotalDays();
  const groupedSchedules = groupByType();

  return (
    <div className="schedule-summary">
      <div className="summary-header">
        <h4>Schedule Summary</h4>
        {onEdit && (
          <Button appearance="subtle" onClick={onEdit}>
            Edit Schedule
          </Button>
        )}
      </div>

      <div className="summary-totals">
        <div className="total-item">
          <span className="total-label">Total Days:</span>
          <span className="total-value">{total}</span>
        </div>
        <div className="total-item">
          <span className="total-label">Full Days:</span>
          <span className="total-value">{fullDays}</span>
        </div>
        <div className="total-item">
          <span className="total-label">Half Days:</span>
          <span className="total-value">{halfDays}</span>
        </div>
      </div>

      <div className="schedule-breakdown">
        {Object.entries(groupedSchedules).map(([type, days]) => (
          <div key={type} className="breakdown-section">
            <h5>{getTypeLabel(type)} ({days.length})</h5>
            <div className="day-list">
              {days.map(day => (
                <div key={day.date} className="day-item">
                  <span className="day-date">
                    {format(new Date(day.date), 'EEE, MMM d, yyyy')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScheduleSummary;