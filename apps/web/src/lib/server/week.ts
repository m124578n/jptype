/**
 * Re-export so server code keeps its own module path; the implementation is shared with the
 * browser (`$lib/time`) because the logged-out `/me` groups its local history the same way.
 */
export { weekOf } from '../time.ts';
