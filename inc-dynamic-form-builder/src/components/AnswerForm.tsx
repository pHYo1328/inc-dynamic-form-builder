import { form, FormState } from "@/types/form";
import { Answer } from "@/types/answer";
import { useState, useEffect } from "react";
import { createDynamicZodSchema } from "@/utils/schemaGenerator";
import { CldUploadButton, CldImage } from 'next-cloudinary';
import { z } from "zod";
import { api } from "@/utils/api";
import { TRPCError } from "@trpc/server";
interface CloudinaryUploadResult {
    info?: {
        secure_url?: string;
    };
}
export const AnswerForm = ({ formData }: { formData: form }) => {
    const parseFormState = (data: any) => {
        if (data && typeof data === 'object' && !Array.isArray(data)) {
            return data;
        }
        return { questions: [] }; // Default initial state
    };
    const formState = parseFormState(formData.formData) as FormState;
    const { data: answer, isLoading } = api.answer.getPreviousAnswer.useQuery({ formId: formData.formId });
    const [answers, setAnswers] = useState<Answer[]>([]);
    const [url, setUrl] = useState<string | null>(null);
    useEffect(() => {
        if (!isLoading) {
            const newAnswers = Array.isArray(answer?.answerData) ? answer?.answerData : [];
            setAnswers(newAnswers as Answer[]);
        }
    }, [answer, isLoading]);
    const submitAnswer = api.answer.addAnswer.useMutation();
    const findAnswerIndex = (questionId: string) => answers.findIndex(answer => answer.questionId === questionId);
    const handleInputChange = (questionId: string, value: string) => {
        const index = findAnswerIndex(questionId);
        if (index > -1) {
            const newAnswers = [...answers];
            newAnswers[index] = { ...newAnswers[index], value } as Answer;
            console.log("created  answer")
            setAnswers(newAnswers);
        } else {
            setAnswers([...answers, { questionId, value }]);
        }
    };


    const handleCheckboxChange = (questionId: string, optionValue: string, isChecked: boolean) => {
        const index = findAnswerIndex(questionId);
        if (index > -1 && index < answers.length) {
            const current = Array.isArray(answers[index]?.value) ? answers[index]?.value as string[] : [];
            const newValue = isChecked ? [...current, optionValue] : current.filter(value => value !== optionValue);
            const newAnswers = [...answers];
            newAnswers[index] = { ...newAnswers[index], value: newValue } as Answer;
            setAnswers(newAnswers);
        } else {
            setAnswers([...answers, { questionId, value: [optionValue] }]);
        }
    };

    const handleSubmitForm = () => {
        // const answersArraySchema = z.array(z.object({ questionId: z.string(), value: dynamicSchema }));

        submitAnswer.mutateAsync({ formId: formData.formId, answer: answers }, { onSuccess: () => { setAnswers([]); }, onError: () => { console.log("there was an error") } });
        // try {

        //     answersArraySchema.parse(answers);

        //   } catch (error) {
        //     if (error instanceof z.ZodError) {
        //         console.log(error.issues);
        //     }
        //     console.error("An unexpected error occurred:", error);
        //   }

    }
    const handleUpload = (result: CloudinaryUploadResult, widget: any, questionId: string) => {
        if (result.info && result.info.secure_url) {
            const index = findAnswerIndex(questionId);
            const newAnswers = [...answers];
    
            if (index > -1) {
                // Update the existing answer
                newAnswers[index] = { ...newAnswers[index], value: result.info.secure_url } as Answer;
            } else {
                // Add a new answer
                newAnswers.push({ questionId, value: result.info.secure_url });
            }
    
            setAnswers(newAnswers);
            setUrl(result.info.secure_url);
        }
    
        widget.close();
    };
    return (
        <div className="mx-72">
            <div className="px-12 py-8 bg-white mb-8 rounded-xl border-t-8 border-purple-700">
                <h2 className="text-4xl focus:border-blue-500 focus:border-b-2 p-2 outline-none">{formData.formTitle}</h2>
            </div>
            <div >
                {formState.questions.map((question) => (
                    <div key={question.questionId} className="px-12 py-4 bg-white mb-8 rounded-2xl">
                        <div className="flex flex-row justify-between mb-3">
                            <p className="bg-gray-100 p-4">{question?.questionText}</p>
                        </div>
                        {question.questionType === "shortAnswer" && (
                            <input className="focus:border-blue-500 focus:border-b-2 p-4 outline-none w-[500px]"
                                value={answers.find(a => a.questionId === question.questionId)?.value || ""}
                                placeholder="Enter short answer"
                                onChange={(e) => handleInputChange(question.questionId, e.target.value)}
                                required={question.required} />
                        )}
                        {question.questionType === "paragraph" && (
                            <textarea className="focus:border-blue-500 focus:border-b-2 p-4 outline-none w-[500px] h-[150px]"
                                value={answers.find(a => a.questionId === question.questionId)?.value || ""}
                                placeholder="Enter Answer"
                                onChange={(e) => handleInputChange(question.questionId, e.target.value)}
                                required={question.required} />
                        )}
                        {question.questionType === "multipleChoice" && (
                            <div>
                                <label className="text-lg font-medium text-gray-700 mb-2">
                                    Choose an option:
                                </label>
                                {question.options?.map((option, oIndex) => {
                                    const isChecked = answers.find(a => a.questionId === question.questionId)?.value === option;
                                    return (
                                        <div key={oIndex} className="flex flex-row items-center mb-3 gap-3">
                                            <input
                                                type="radio"
                                                name={`question_${question.questionId}`}
                                                id={`option_${question.questionId}_${oIndex}`}
                                                value={option}
                                                onChange={(e) => handleInputChange(question.questionId, e.target.value)}
                                                checked={isChecked}
                                                required={question.required}
                                            />
                                            <label htmlFor={`option_${question.questionId}_${oIndex}`}>{option}</label>
                                        </div>
                                    )
                                })}
                            </div>

                        )}
                        {question.questionType === "checkbox" && (
                            <div>
                                <label className="text-lg font-medium text-gray-700 mb-2">
                                    Select the options:
                                </label>
                                {question.options?.map((option, oIndex) => {
                                    const answerValue = answers.find(a => a.questionId === question.questionId)?.value;
                                    const isChecked = Array.isArray(answerValue) ? answerValue.includes(option) : false;
                                    return (<div key={oIndex} className="flex flex-row items-center mb-3 gap-3">
                                        <input
                                            type="checkbox"
                                            value={option}
                                            id={`option_${question.questionId}_${oIndex}`}
                                            onChange={(e) => handleCheckboxChange(question.questionId, option, e.target.checked)}
                                            checked={isChecked}
                                        />
                                        <label htmlFor={`option_${question.questionId}_${oIndex}`}>{option}</label>
                                    </div>)
                                })}
                            </div>
                        )}
                        {question.questionType === "dropdown" && (
                            <select
                                value={answers.find(a => a.questionId === question.questionId)?.value || ''}
                                onChange={(e) => handleInputChange(question.questionId, e.target.value)}
                                required={question.required}>
                                {question.options?.map((option, oIndex) => (
                                    <option key={oIndex} value={option}>{option}</option>
                                ))}
                            </select>

                        )}

                        {question.questionType === "fileUpload" && (
                            <div>
                                <CldUploadButton
                                    className='bg-red'
                                    onUpload={(result, widget) => {
                                        console.log(result)
                                        handleUpload(result as CloudinaryUploadResult, widget, question.questionId)
                                    }}
                                    uploadPreset="phyonn"
                                />
                                {
                                    (answers.find(a => a.questionId === question.questionId)?.value || url) && (
                                        <CldImage
                                            width="200"
                                            height="200"
                                            src={answers.find(a => a.questionId === question.questionId)?.value as string || url as string}
                                            sizes="100vw"
                                            alt="Uploaded Image"
                                        />
                                    )
                                }

                            </div>
                        )}
                        {question.questionType === "linearScale" && (
                            <div className="flex flex-row items-end p-4">
                                <p>{question?.linearStartText}</p>
                                {Array.from({ length: question?.linearEnd - question?.linearStart + 1 }, (_, i) => i + question?.linearStart).map((number) => {
                                    const isChecked = answers.find(a => a.questionId === question.questionId)?.value === number.toString();
                                    return (
                                        <div key={number} className="flex flex-col items-center px-3">
                                            <input
                                                type="radio"
                                                name={`linear_scale_question_${question.questionId}`}
                                                value={number}
                                                checked={isChecked}
                                                onChange={(e) => handleInputChange(question.questionId, e.target.value)}
                                                required={question.required}
                                            />
                                            <label>{number}</label>
                                        </div>
                                    )
                                })}
                                <p>{question?.linearEndText}</p>
                            </div>
                        )}
                        {question.questionType === "Date" && (
                            <input type="date"
                                value={answers.find(a => a.questionId === question.questionId)?.value || ''}
                                className="flex flex-row w-[200px] justify-between items-center border-b-2 border-dotted pb-3 mb-12"
                                onChange={(e) => handleInputChange(question.questionId, e.target.value)}
                                required={question.required} />
                        )}
                        {question.questionType === "Time" && (
                            <input type="time"
                                value={answers.find(a => a.questionId === question.questionId)?.value || ''}
                                className="flex flex-row w-[200px] justify-between items-center border-b-2 border-dotted pb-3 mb-12"
                                onChange={(e) => handleInputChange(question.questionId, e.target.value)}
                                required={question.required} />
                        )}
                    </div>
                ))}
            </div>
            <div className="flex flex-row justify-between">
                <button className="bg-blue-500 px-2 py-1 rounded text-white" onClick={handleSubmitForm}>Submit</button>
                <button className="bg-blue-500 px-2 py-1 rounded text-white" onClick={() => { setAnswers([]) }}>Clear</button>
            </div>
        </div>
    )
}