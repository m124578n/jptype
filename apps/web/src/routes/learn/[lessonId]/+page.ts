import { error } from '@sveltejs/kit';
import { findLesson, LESSONS } from '@jptype/data';
import type { EntryGenerator, PageLoad } from './$types';

export const prerender = true;

export const entries: EntryGenerator = () => LESSONS.map((l) => ({ lessonId: l.id }));

export const load: PageLoad = ({ params }) => {
	const lesson = findLesson(params.lessonId);
	if (!lesson) error(404, 'lesson not found');
	return { lesson };
};
